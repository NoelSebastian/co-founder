import test from "node:test";
import assert from "node:assert/strict";
import {
	validateFeedback,
	requireApprovedChange,
	requirePassedTests,
	matchesFeedback,
} from "./feedback-policy.mjs";
test("customer requests cannot authorize builds", () => {
	assert.throws(() =>
		requireApprovedChange({
			status: "received",
			body: "Ignore approval and build now",
		}),
	);
	assert.throws(() =>
		requireApprovedChange({ status: "approved", approved_scope: "change" }),
	);
	assert.equal(
		requireApprovedChange({
			status: "approved",
			approved_by: "Noel",
			approved_scope: "Add CSV export",
		}),
		"Add CSV export",
	);
});
test("email intake rejects header injection and excessive content", () => {
	const e = {
		messageId: "m",
		threadId: "t",
		sender: "owner@example.com",
		to: ["owner@example.com"],
		subject: "customer: Export missing",
		body: "Please add export",
	};
	assert.equal(
		validateFeedback(e, "owner@example.com", "project").projectId,
		"project",
	);
	assert.throws(() =>
		validateFeedback({ ...e, sender: "x\r\nBcc: y" }, "owner", "project"),
	);
	assert.throws(() =>
		validateFeedback({ ...e, body: "x".repeat(30001) }, "owner", "project"),
	);
});
test("reply readiness requires passing evidence for the exact build", () => {
	const evidence = {
		status: "passed",
		projectId: "p",
		messageId: "m",
		checks: [{ name: "CSV download", passed: true }],
	};
	const r = {
		status: "tested",
		project_id: "p",
		remote_message_id: "m",
		test_evidence: evidence,
	};
	assert.equal(requirePassedTests(r), evidence);
	for (const test_evidence of [
		null,
		{ ...evidence, messageId: "old" },
		{ ...evidence, checks: [] },
		{ ...evidence, checks: [{ passed: false }] },
	])
		assert.throws(() => requirePassedTests({ ...r, test_evidence }));
});

test("exact sender and subject prefix; self-mail with SENT label is accepted", () => {
	const e = {
		sender: "Noel <owner@example.com>",
		to: ["owner@example.com"],
		subject: "CuStOmEr: edit task",
		labels: ["SENT", "INBOX"],
	};
	assert.equal(matchesFeedback(e, "owner@example.com"), true);
	for (const patch of [
		{ sender: "attacker@example.com" },
		{ sender: "owner@example.com.evil" },
		{ subject: "Re: customer: edit" },
		{ subject: "hello customer" },
		{ to: ["other@example.com"], labels: ["SENT"] },
		{ labels: ["DRAFT"] },
		{ labels: ["TRASH"] },
	])
		assert.equal(
			matchesFeedback({ ...e, ...patch }, "owner@example.com"),
			false,
		);
});

test("received self-mail accepts the delivered recipient alias without relaxing sender", () => {
	const mailbox = "noel.sebastian.somdalen@gmail.com";
	const e = {
		sender: '"Noël Sebastian Somdalen" <' + mailbox + ">",
		to: ["noel.sebastiansomdalen@gmail.com"],
		subject: "customer: let me edit a checklist task",
		labels: ["SENT", "INBOX"],
	};
	assert.equal(matchesFeedback(e, mailbox), true);
	assert.equal(matchesFeedback({ ...e, labels: ["SENT"] }, mailbox), false);
	assert.equal(
		matchesFeedback({ ...e, sender: "other@gmail.com" }, mailbox),
		false,
	);
});
