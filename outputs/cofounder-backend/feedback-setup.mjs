import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { privateDir, humans, assistant, builder } from "./config.mjs";
import { db } from "./db.mjs";
import { signed, publish } from "./relay.mjs";
const file = path.join(privateDir, "feedback-config.json");
const config = fs.existsSync(file)
	? JSON.parse(fs.readFileSync(file))
	: {
			room: randomUUID(),
			createdAt: Math.floor(Date.now() / 1000),
			projectId: "f15dee08-058b-4f62-a23e-f6b31f0a7e3e",
			mailbox: "noel.sebastian.somdalen@gmail.com",
			watcher: "not_configured",
		};
if (!fs.existsSync(file))
	fs.writeFileSync(file, JSON.stringify(config, null, 2), {
		mode: 0o600,
		flag: "wx",
	});
await db.query(`CREATE TABLE IF NOT EXISTS cofounder.feedback (
 id uuid PRIMARY KEY, mailbox text NOT NULL, message_id text NOT NULL, email_thread_id text NOT NULL,
 sender text NOT NULL, subject text NOT NULL, body text NOT NULL, room text NOT NULL, chat_thread text,
 project_id text NOT NULL, status text NOT NULL DEFAULT 'received', recommendation text,
 approved_by text, approved_at timestamptz, approved_scope text, remote_message_id text,
 test_evidence jsonb, reply_draft_id text, error text, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(mailbox,message_id));`);
// Persist exact signed provisioning events so reruns do not duplicate channel notices.
const seedFile = path.join(privateDir, "feedback-seed.json");
let events;
if (fs.existsSync(seedFile)) events = JSON.parse(fs.readFileSync(seedFile));
else {
	events = [
		signed(humans[0], 9007, "", [
			["h", config.room],
			["name", "customer-feedback"],
			["channel_type", "stream"],
			["visibility", "private"],
		]),
		...[humans[1], assistant, builder].map((u) =>
			signed(humans[0], 9000, "", [
				["h", config.room],
				["p", u.pubkey],
			]),
		),
	];
	fs.writeFileSync(seedFile, JSON.stringify(events), {
		mode: 0o600,
		flag: "wx",
	});
}
for (const event of events) await publish(event);
console.log(
	JSON.stringify({
		room: config.room,
		project: config.projectId,
		watcher: config.watcher,
	}),
);
await db.end();
