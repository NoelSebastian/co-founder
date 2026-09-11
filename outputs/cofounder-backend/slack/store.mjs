import fs from "node:fs";
import path from "node:path";
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "node:crypto";
import { db } from "../db.mjs";
import { privateDir } from "../config.mjs";
export const hash = (x) => createHash("sha256").update(x).digest("hex");
export const error = (message, status = 400) =>
  Object.assign(new Error(message), { status });
function key() {
  const dir = path.join(privateDir, "slack");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, "key");
  if (!fs.existsSync(file))
    fs.writeFileSync(file, randomBytes(32), { flag: "wx", mode: 0o600 });
  return fs.readFileSync(file);
}
export function seal(value, k = key()) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", k, iv);
  return Buffer.concat([
    iv,
    c.update(JSON.stringify(value)),
    c.final(),
    c.getAuthTag(),
  ]).toString("base64");
}
export function unseal(value, k = key()) {
  const b = Buffer.from(value, "base64"),
    d = createDecipheriv("aes-256-gcm", k, b.subarray(0, 12));
  d.setAuthTag(b.subarray(-16));
  return JSON.parse(
    Buffer.concat([d.update(b.subarray(12, -16)), d.final()]).toString(),
  );
}
export async function migrateSlack() {
  await db.query(`CREATE TABLE IF NOT EXISTS cofounder.slack_config(id boolean PRIMARY KEY DEFAULT true CHECK(id), secret text NOT NULL);
CREATE TABLE IF NOT EXISTS cofounder.slack_oauth(state text PRIMARY KEY, actor text NOT NULL, return_origin text NOT NULL, expires timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS cofounder.slack_connections(id uuid PRIMARY KEY,actor text NOT NULL,team text NOT NULL,user_id text NOT NULL,team_name text NOT NULL,secret text NOT NULL,scopes text NOT NULL,status text NOT NULL DEFAULT 'connected',created_at timestamptz DEFAULT now(),UNIQUE(actor,team));
CREATE TABLE IF NOT EXISTS cofounder.slack_events(id text PRIMARY KEY,team text NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS cofounder.slack_operations(id uuid PRIMARY KEY,connection uuid NOT NULL REFERENCES cofounder.slack_connections(id) ON DELETE CASCADE,kind text NOT NULL,payload jsonb NOT NULL,status text NOT NULL DEFAULT 'pending',result jsonb,error text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS cofounder.slack_limits(team text,method text,until_at timestamptz NOT NULL,PRIMARY KEY(team,method));`);
  await db.query(
    "UPDATE cofounder.slack_operations SET status='uncertain',error='Service restarted before confirmation. Check Slack before sending again.' WHERE status='sending'",
  );
}
export async function configuration() {
  const r = await db.query(
    "SELECT secret FROM cofounder.slack_config WHERE id=true",
  );
  return r.rowCount ? unseal(r.rows[0].secret) : null;
}
export async function connection(actor, id) {
  const r = await db.query(
    "SELECT * FROM cofounder.slack_connections WHERE id=$1 AND actor=$2",
    [id, actor],
  );
  if (!r.rowCount) throw error("Slack connection not found.", 404);
  if (r.rows[0].status !== "connected")
    throw error("Reconnect your Slack account to continue.", 401);
  return r.rows[0];
}
