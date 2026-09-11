import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, migrate } from "./db.mjs";
import { humans } from "./config.mjs";
import { importFeedback, approveFeedback } from "./feedback.mjs";
import {
	feedbackTick,
	recoverFeedback,
	recordFeedbackTests,
} from "./feedback-worker.mjs";
import { normalizeGmail, feedbackConfig } from "./gmail.mjs";
const lock = await db.connect();
if (
	!(await lock.query("SELECT pg_try_advisory_lock(98217411) AS locked")).rows[0]
		.locked
) {
	lock.release();
	await db.end();
	throw Error(
		"Stop the workflow service before running disposable worker integration tests.",
	);
}
await migrate();
const ids = [];
const cfg = feedbackConfig();
async function fixture() {
	const id = await importFeedback({
		messageId: "test-" + randomUUID(),
		threadId: "test-thread",
		sender: cfg.mailbox,
		to: [cfg.mailbox],
		subject: "customer: TEST fixture",
		body: "Rename a task and retain completion",
		labels: ["INBOX", "SENT"],
	});
	ids.push(id);
	await db.query(
		"UPDATE cofounder.feedback SET status='needs_approval',recommendation='Rename a task' WHERE id=$1",
		[id],
	);
	return id;
}
const row = async (id) =>
	(await db.query("SELECT * FROM cofounder.feedback WHERE id=$1", [id]))
		.rows[0];
const options = {
	poll: async () => {},
	connection: () => ({ connected: false }),
};
test("durable feedback workflow: intake, approval, one dispatch, test gate, draft only", async () => {
	try {
		const id = await fixture(),
			f = await row(id);
		const duplicate = await importFeedback({
			messageId: f.message_id,
			threadId: f.email_thread_id,
			sender: f.sender,
			to: [cfg.mailbox],
			subject: f.subject,
			body: f.body,
		});
		assert.equal(duplicate, id);
		await assert.rejects(() =>
			approveFeedback(id, "outsider", "Rename task", "checklist-rename"),
		);
		await assert.rejects(() =>
			approveFeedback(id, humans[0].pubkey, "", "checklist-rename"),
		);
		await approveFeedback(
			id,
			humans[0].pubkey,
			"Rename task and preserve completion",
			"checklist-rename",
		);
		await assert.rejects(() =>
			approveFeedback(id, humans[1].pubkey, "Different scope", "manual"),
		);
		let sends = 0;
		const lovable = async (name, args) => {
			assert.equal(args.project_id, cfg.projectId);
			if (name === "send_message") {
				sends++;
				assert.match(args.message, /Rename task and preserve completion/);
				return { message_id: "test-build" };
			}
			assert.equal(name, "get_message");
			return { response: { status: "completed" } };
		};
		await feedbackTick({ ...options, lovable });
		assert.equal((await row(id)).status, "building");
		assert.equal(sends, 1);
		await feedbackTick({ ...options, lovable });
		assert.equal((await row(id)).status, "awaiting_tests");
		assert.equal(sends, 1);
		await assert.rejects(() =>
			recordFeedbackTests(id, {
				status: "passed",
				projectId: cfg.projectId,
				messageId: "wrong",
				checks: [{ name: "test", passed: true }],
			}),
		);
		await feedbackTick({
			...options,
			browserTest: async () => ({
				status: "failed",
				projectId: cfg.projectId,
				messageId: "test-build",
				checks: [{ name: "Rename persists", passed: false }],
			}),
		});
		assert.equal((await row(id)).status, "tests_failed");
		assert.equal((await row(id)).reply_body, null);
		await recordFeedbackTests(id, {
			status: "passed",
			projectId: cfg.projectId,
			messageId: "test-build",
			checks: [{ name: "Rename persists", passed: true }],
		});
		let drafts = 0;
		await feedbackTick({
			...options,
			connection: () => ({ connected: true }),
			createDraft: async (r) => {
				drafts++;
				assert.match(r.reply_body, /Thanks for taking the time/);
                assert.match(r.reply_body, /meets your needs/);
                assert.doesNotMatch(r.reply_body, /Verified checks|Rename persists|## /);
				return { id: "test-draft" };
			},
		});
		assert.equal((await row(id)).status, "reply_ready");
		assert.equal(drafts, 1);
		await feedbackTick({
			...options,
			createDraft: async () => {
				throw Error("Duplicate draft");
			},
		});
		const uncertain = await fixture();
		await approveFeedback(
			uncertain,
			humans[0].pubkey,
			"Rename",
			"checklist-rename",
		);
		let attempts = 0;
		await feedbackTick({
			...options,
			lovable: async () => {
				attempts++;
				throw Error("Timeout after dispatch");
			},
		});
		assert.equal((await row(uncertain)).status, "needs_review");
		await feedbackTick({
			...options,
			lovable: async () => {
				attempts++;
			},
		});
		assert.equal(attempts, 1);
		await db.query(
			"UPDATE cofounder.feedback SET status='dispatching' WHERE id=$1",
			[uncertain],
		);
		await recoverFeedback();
		assert.equal((await row(uncertain)).status, "needs_review");
	} finally {
		for (const id of ids) {
			await db.query("DELETE FROM cofounder.outbox WHERE id LIKE $1", [
				`feedback:${id}%`,
			]);
			await db.query("DELETE FROM cofounder.feedback WHERE id=$1", [id]);
		}
		lock.release();
		await db.end();
	}
});
test("Gmail multipart normalization retains self-mail recipient and plain body", () => {
	const n = normalizeGmail({
		id: "m",
		threadId: "t",
		labelIds: ["INBOX", "SENT"],
		payload: {
			headers: [
				{ name: "From", value: cfg.mailbox },
				{ name: "To", value: cfg.mailbox },
				{ name: "Subject", value: "customer: task" },
			],
			parts: [
				{
					mimeType: "text/plain",
					body: { data: Buffer.from("Customer request").toString("base64url") },
				},
			],
		},
	});
	assert.equal(n.body, "Customer request");
	assert.deepEqual(n.to, [cfg.mailbox]);
});
