import { db } from "../db.mjs";
import { error } from "./store.mjs";
import { call } from "./client.mjs";
import { upload } from "./files.mjs";
import { isDeepStrictEqual } from "node:util";
export function validateOperation(kind, p) {
  if (p.unfurl_links !== undefined && typeof p.unfurl_links !== "boolean")
    throw error("Invalid link preview option.");
  if (kind === "create-channel") {
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(p.name || "") || typeof p.is_private !== "boolean")
      throw error("Use a channel name up to 80 lowercase letters, numbers, hyphens or underscores.");
    return;
  }
  if (!/^[CGD][A-Z0-9]+$/.test(p.channel || ""))
    throw error("Choose a Slack conversation.");
  if (
    ["edit", "delete", "react", "unreact", "mark"].includes(kind) &&
    !/^\d+\.\d+$/.test(p.ts || "")
  )
    throw error("Invalid Slack message timestamp.");
  if (
    ["send", "edit"].includes(kind) &&
    (!p.text?.trim() || p.text.length > 4000)
  )
    throw error("Messages must contain between 1 and 4,000 characters.");
  if (
    p.blocks !== undefined &&
    (!Array.isArray(p.blocks) ||
      p.blocks.length > 50 ||
      p.blocks.some((b) => b?.type !== "rich_text") ||
      JSON.stringify(p.blocks).length > 80000)
  )
    throw error("Invalid rich-text message.");
  if (p.reply_broadcast !== undefined && typeof p.reply_broadcast !== "boolean")
    throw error("Invalid reply broadcast option.");
  if (p.reply_broadcast && !p.thread_ts)
    throw error("Broadcast requires a thread.");
  if (p.thread_ts && !/^\d+\.\d+$/.test(p.thread_ts))
    throw error("Invalid thread timestamp.");
  if (["react", "unreact"].includes(kind) && !/^[-+\w]+$/.test(p.name || ""))
    throw error("Choose a valid emoji.");
  if (
    !["send", "edit", "delete", "react", "unreact", "mark", "upload"].includes(
      kind,
    )
  )
    throw error("Unsupported Slack action.");
}
export async function operate(c, id, kind, p, api = call) {
  if (!/^[a-f0-9-]{36}$/.test(id || ""))
    throw error("A unique request ID is required.");
  validateOperation(kind, p);
  await db.query(
    "INSERT INTO cofounder.slack_operations(id,connection,kind,payload) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    [id, c.id, kind, p],
  );
  const lock = await db.connect();
  try {
    await lock.query("SELECT pg_advisory_lock(hashtext($1))", [
      "slack-operation:" + id,
    ]);
    let row = (
      await lock.query(
        "SELECT * FROM cofounder.slack_operations WHERE id=$1 AND connection=$2",
        [id, c.id],
      )
    ).rows[0];
    if (!row) throw error("Request ID belongs to another connection.", 409);
    if (
      row.kind !== kind ||
      Object.keys(p).some(
        (k) => k !== "base64" && !isDeepStrictEqual(row.payload[k], p[k]),
      )
    )
      throw error("Request ID was already used for a different action.", 409);
    if (row.status !== "pending") return row;
    await lock.query(
      "UPDATE cofounder.slack_operations SET status='sending',updated_at=now() WHERE id=$1",
      [id],
    );
    try {
      if (kind === "edit" || kind === "delete") {
        const r = await api(c, "conversations.history", {
          channel: p.channel,
          latest: p.ts,
          oldest: p.ts,
          inclusive: true,
          limit: 1,
        });
        let message = r.messages?.find((m) => m.ts === p.ts);
        if (!message && p.thread_ts) {
          const r = await api(c, "conversations.replies", {
            channel: p.channel,
            ts: p.thread_ts,
            oldest: p.ts,
            latest: p.ts,
            inclusive: true,
            limit: 2,
          });
          message = r.messages?.find((m) => m.ts === p.ts);
        }
        if (message?.user !== c.user_id)
          throw error("You can only change your own Slack messages.", 403);
      }
      const args = { channel: p.channel };
      let method;
      if (kind === "send") {
        method = "chat.postMessage";
        Object.assign(args, {
          text: p.text,
          ...(p.blocks ? { blocks: p.blocks } : {}),
          client_msg_id: id,
          as_user: true,
          ...(p.thread_ts
            ? { thread_ts: p.thread_ts, reply_broadcast: !!p.reply_broadcast }
            : {}),
          unfurl_links: p.unfurl_links === true,
          unfurl_media: false,
        });
      }
      if (kind === "edit") {
        method = "chat.update";
        Object.assign(args, {
          ts: p.ts,
          text: p.text,
          ...(p.blocks ? { blocks: p.blocks } : {}),
        });
      }
      if (kind === "delete") {
        method = "chat.delete";
        args.ts = p.ts;
      }
      if (kind === "react" || kind === "unreact") {
        method = "reactions." + (kind === "react" ? "add" : "remove");
        Object.assign(args, { timestamp: p.ts, name: p.name });
      }
      if (kind === "mark") {
        method = "conversations.mark";
        args.ts = p.ts;
      }
      if (kind === "create-channel") {
        method = "conversations.create";
        delete args.channel;
        Object.assign(args, { name: p.name, is_private: p.is_private });
      }
      const result =
        kind === "upload" ? await upload(c, p) : await api(c, method, args);
      await lock.query(
        "UPDATE cofounder.slack_operations SET status='delivered',result=$2,payload=payload-'base64',updated_at=now() WHERE id=$1",
        [id, result],
      );
    } catch (e) {
      await lock.query(
        "UPDATE cofounder.slack_operations SET status=$2,error=$3,updated_at=now() WHERE id=$1 AND status<>'delivered'",
        [id, e.uncertain ? "uncertain" : "failed", e.message],
      );
    }
    return (
      await lock.query("SELECT * FROM cofounder.slack_operations WHERE id=$1", [
        id,
      ])
    ).rows[0];
  } finally {
    try {
      await lock.query("SELECT pg_advisory_unlock(hashtext($1))", [
        "slack-operation:" + id,
      ]);
    } finally {
      lock.release();
    }
  }
}
