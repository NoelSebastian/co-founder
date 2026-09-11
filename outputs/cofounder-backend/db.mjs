import pg from "pg";
import { envFile } from "./config.mjs";
const e = envFile(".env");
export const db = new pg.Pool({
	host: "127.0.0.1",
	port: 5433,
	user: e.POSTGRES_USER || "buzz",
	password: e.POSTGRES_PASSWORD,
	database: e.POSTGRES_DB || "buzz",
	max: 5,
});
export async function migrate() {
	await db.query(`
CREATE SCHEMA IF NOT EXISTS cofounder;
CREATE TABLE IF NOT EXISTS cofounder.feedback (
 id uuid PRIMARY KEY, mailbox text NOT NULL, message_id text NOT NULL, email_thread_id text NOT NULL,
 sender text NOT NULL, subject text NOT NULL, body text NOT NULL, room text NOT NULL, chat_thread text,
 project_id text NOT NULL, status text NOT NULL DEFAULT 'received', recommendation text,
 approved_by text, approved_at timestamptz, approved_scope text, remote_message_id text,
 test_evidence jsonb, reply_draft_id text, error text, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(mailbox,message_id));
ALTER TABLE cofounder.feedback ADD COLUMN IF NOT EXISTS remote_thread_id text;
ALTER TABLE cofounder.feedback ADD COLUMN IF NOT EXISTS reply_body text;
ALTER TABLE cofounder.feedback ADD COLUMN IF NOT EXISTS test_plan jsonb;
ALTER TABLE cofounder.feedback ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE cofounder.feedback ADD COLUMN IF NOT EXISTS chat_scope text;
ALTER TABLE cofounder.feedback ADD COLUMN IF NOT EXISTS chat_approval_after bigint;
CREATE TABLE IF NOT EXISTS cofounder.briefs(id uuid PRIMARY KEY,room text NOT NULL,thread text NOT NULL,title text NOT NULL,version integer NOT NULL,content text NOT NULL,status text NOT NULL DEFAULT 'draft',author text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS cofounder.revisions(brief_id uuid REFERENCES cofounder.briefs(id),version integer,content text NOT NULL,approved_by text,approved_at timestamptz,PRIMARY KEY(brief_id,version));
CREATE TABLE IF NOT EXISTS cofounder.jobs(id uuid PRIMARY KEY,brief_id uuid REFERENCES cofounder.briefs(id),version integer NOT NULL,actor text NOT NULL,status text NOT NULL DEFAULT 'queued',project_id text,message_id text,preview_url text,editor_url text,error text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(brief_id,version));
CREATE TABLE IF NOT EXISTS cofounder.priorities(id uuid PRIMARY KEY,title text NOT NULL,owner text NOT NULL,done boolean NOT NULL DEFAULT false,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS cofounder.outbox(id text PRIMARY KEY,event jsonb NOT NULL,sent boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS cofounder.commands(id text PRIMARY KEY,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS cofounder.nonces(id text PRIMARY KEY,created_at timestamptz DEFAULT now());
`);
}
export async function tx(fn) {
	const c = await db.connect();
	try {
		await c.query("BEGIN");
		const r = await fn(c);
		await c.query("COMMIT");
		return r;
	} catch (e) {
		await c.query("ROLLBACK");
		throw e;
	} finally {
		c.release();
	}
}
