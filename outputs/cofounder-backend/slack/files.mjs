import { call } from "./client.mjs";
import {db} from "../db.mjs";
import { error, unseal } from "./store.mjs";
export const MAX_FILE = 10 * 1024 * 1024;
export async function upload(c, p) {
  const bytes = Buffer.from(p.base64 || "", "base64");
  if (!bytes.length || bytes.length > MAX_FILE)
    throw error("Choose a file up to 10 MB.");
  const name = String(p.name || "attachment")
    .replace(/[\r\n/\\]/g, "_")
    .slice(0, 200);
  const slot = await call(c, "files.getUploadURLExternal", {
    filename: name,
    length: bytes.length,
  });
  const url = new URL(slot.upload_url);
  if (
    url.protocol !== "https:" ||
    !(url.hostname === "files.slack.com" || url.hostname.endsWith(".slack.com"))
  )
    throw error("Slack returned an unexpected upload host.");
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      body: bytes,
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    const e = error("File upload was interrupted before completion.", 502);
    e.uncertain = true;
    throw e;
  }
  if (!response.ok) throw error("Slack rejected the file upload.", 502);
  return call(c, "files.completeUploadExternal", {
    files: [{ id: slot.file_id, title: name }],
    channel_id: p.channel,
    ...(p.thread_ts ? { thread_ts: p.thread_ts } : {}),
  });
}
export async function download(c, id) {
  const r = await call(c, "files.info", { file: id });
  const file = r.file;
  if (!file?.url_private_download && !file?.url_private)
    throw error("Slack has not made this file available.", 404);
  const current=(await db.query("SELECT secret FROM cofounder.slack_connections WHERE id=$1 AND actor=$2 AND status='connected'",[c.id,c.actor])).rows[0];
  if(!current)throw error('Reconnect your Slack account.',401);
  let url = new URL(file.url_private_download || file.url_private);
  let result;
  for (let i = 0; i < 4; i++) {
    if (
      url.protocol !== "https:" ||
      !(
        url.hostname === "files.slack.com" ||
        url.hostname.endsWith(".slack.com")
      )
    )
      throw error("Unexpected Slack file host.");
    result = await fetch(url, {
      headers: { Authorization: "Bearer " + unseal(current.secret).accessToken },
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    if (result.status >= 300 && result.status < 400) {
      url = new URL(result.headers.get("location"), url);
      continue;
    }
    break;
  }
  if (!result?.ok) throw error("Could not download this Slack file.", 502);
  if (Number(result.headers.get("content-length")) > MAX_FILE)
    throw error(
      "This file exceeds the in-app 10 MB download limit. Open it in Slack.",
      413,
    );
  const chunks = [];
  let size = 0;
  for await (const chunk of result.body) {
    size += chunk.length;
    if (size > MAX_FILE)
      throw error(
        "File exceeds the in-app download limit. Open it in Slack.",
        413,
      );
    chunks.push(chunk);
  }
  return {
    name: file.name || "attachment",
    mime: file.mimetype || "application/octet-stream",
    base64: Buffer.concat(chunks).toString("base64"),
  };
}
