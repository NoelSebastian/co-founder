import { verifyEvent } from "nostr-tools";
import { db, tx } from "./db.mjs";
import { humans, assistant } from "./config.mjs";
import { signed, threadOf } from "./relay.mjs";
export function isChatApproval(e) {
	return (
		e?.kind === 9 &&
		verifyEvent(e) &&
		humans.some((h) => h.pubkey === e.pubkey) &&
		/^yes[.!]?$/i.test(e.content.trim()) &&
		threadOf(e) !== e.id
	);
}
export async function offerChatApproval(id, scope, profile = "manual") {
	return tx(async (c) => {
		const {
			rows: [f],
		} = await c.query(
			"SELECT * FROM cofounder.feedback WHERE id=$1 FOR UPDATE",
			[id],
		);
		if (f?.status !== "needs_approval" || !f.chat_thread)
			throw Error("No pending recommendation");
		if (f.chat_scope) return;
		const e = signed(
			assistant,
			9,
			`Proposed change:\n\n${scope}\n\nReply **yes** in this thread to approve and start Lovable. I’ll then test the change and prepare an unsent email reply.`,
			[
				["h", f.room],
				["e", f.chat_thread, "", "reply"],
			],
		);
		await c.query(
			"UPDATE cofounder.feedback SET chat_scope=$2,chat_approval_after=$3,test_plan=$4 WHERE id=$1",
			[id, scope, e.created_at, JSON.stringify({ profile })],
		);
		await c.query(
			"INSERT INTO cofounder.outbox(id,event) VALUES($1,$2) ON CONFLICT DO NOTHING",
			[`feedback:${id}:chat-offer`, e],
		);
	});
}
export async function approveFeedbackFromChat(e) {
	if (!isChatApproval(e)) return false;
	return tx(async (c) => {
		const room = e.tags.find((t) => t[0] === "h")?.[1];
		const {
			rows: [f],
		} = await c.query(
			"SELECT * FROM cofounder.feedback WHERE room=$1 AND chat_thread=$2 AND status='needs_approval' AND chat_scope IS NOT NULL AND chat_approval_after<=$3 FOR UPDATE",
			[room, threadOf(e), e.created_at],
		);
		if (!f) return false;
		const command = await c.query(
			"INSERT INTO cofounder.commands(id) VALUES($1) ON CONFLICT DO NOTHING RETURNING id",
			[e.id],
		);
		if (!command.rowCount) return false;
		await c.query(
			"UPDATE cofounder.feedback SET approved_scope=chat_scope,approved_by=$2,approved_at=now(),status='approved',updated_at=now() WHERE id=$1",
			[f.id, e.pubkey],
		);
		const reply = signed(
			assistant,
			9,
			"Approved. I’m starting the change in your existing Lovable app, then running the checks. The email reply will remain a draft.",
			[
				["h", room],
				["e", f.chat_thread, "", "reply"],
			],
		);
		await c.query(
			"INSERT INTO cofounder.outbox(id,event) VALUES($1,$2) ON CONFLICT DO NOTHING",
			[`feedback:${f.id}:chat-approved`, reply],
		);
		return true;
	});
}
