import {createDownloadTicket} from "./download-ticket.mjs";
import { db } from "../db.mjs";
import { humans } from "../config.mjs";
import { connection, configuration, error } from "./store.mjs";
import { begin, configure, manifest } from "./oauth.mjs";
import { call } from "./client.mjs";
import { operate } from "./operations.mjs";
import { download } from "./files.mjs";
import { startSlackSync, syncState } from "./sync.mjs";
export async function slackApi(actor, route, b, method, returnOrigin) {
  if (route === "status") {
    const config = await configuration();
    const rows = (
      await db.query(
        "SELECT id,team,user_id,team_name,scopes,status FROM cofounder.slack_connections WHERE actor=$1 ORDER BY created_at",
        [actor],
      )
    ).rows;
    return {
      configured: !!config,
      canConfigure: actor === humans[0].pubkey,
      redirectUri: config?.redirectUri || "",
      connections: rows,
      sync: syncState,
    };
  }
  if (route === "manifest")
    return manifest(
      b.redirectUri || "https://YOUR-CALLBACK-HOST/slack/callback",
    );
  if (method !== "POST") throw error("Use POST for Slack requests.", 405);
  if (route === "configure") {
    const result = await configure(actor, b);
    void startSlackSync();
    return result;
  }
  if (route === "connect") return begin(actor, returnOrigin);
  if (route === "disconnect") {
    const r = await db.query(
      "SELECT status FROM cofounder.slack_connections WHERE id=$1 AND actor=$2",
      [b.connection, actor],
    );
    if (r.rowCount && r.rows[0].status !== "connected") {
      await db.query(
        "DELETE FROM cofounder.slack_connections WHERE id=$1 AND actor=$2",
        [b.connection, actor],
      );
      return { ok: true };
    }
  }
  const c = await connection(actor, b.connection);
  if (route === "disconnect") {
    await call(c, "auth.revoke");
    await db.query(
      "DELETE FROM cofounder.slack_connections WHERE id=$1 AND actor=$2",
      [c.id, actor],
    );
    return { ok: true };
  }
  if (route === "updates") {
    const revision = (
      await db.query(
        "SELECT max(created_at)::text AS revision FROM cofounder.slack_events WHERE team=$1",
        [c.team],
      )
    ).rows[0].revision;
    return {
      revision,
      sync: syncState,
      operations: (
        await db.query(
          "SELECT id,kind,payload-'base64' AS payload,status,result,error,created_at FROM cofounder.slack_operations WHERE connection=$1 AND ($2::text IS NULL OR payload->>'channel'=$2) ORDER BY created_at DESC LIMIT 30",
          [c.id, b.channel || null],
        )
      ).rows,
    };
  }
  if (route === "conversations")
    return call(c, "conversations.list", {
      types: "public_channel,private_channel,im,mpim",
      exclude_archived: true,
      limit: 100,
      cursor: b.cursor || undefined,
    });
  if (route === "info")
    return call(c, "conversations.info", {
      channel: b.channel,
      include_num_members: true,
    });
  if (route === "history")
    return call(
      c,
      b.thread ? "conversations.replies" : "conversations.history",
      {
        channel: b.channel,
        ...(b.thread ? { ts: b.thread } : {}),
        limit: 100,
        cursor: b.cursor || undefined,
      },
    );
  if (route === "users")
    return call(c, "users.list", { limit: 100, cursor: b.cursor || undefined });
  if (route === "invite") {
    if (!/^[CG][A-Z0-9]+$/.test(b.channel || "") || !/^U[A-Z0-9]+$/.test(b.user || ""))
      throw error("Choose a Slack channel and user.");
    try {
      return await call(c, "conversations.invite", { channel: b.channel, users: b.user });
    } catch (e) {
      if (e.message?.includes("already_in_channel")) return { ok: true };
      throw e;
    }
  }
  if (route === "user") return call(c, "users.info", { user: b.user });
  if (route === "emoji") return call(c, "emoji.list");
  if (route === "usergroups") return call(c, "usergroups.list");
  if (route === "search") {
    if (!b.query?.trim() || b.query.length > 500)
      throw error("Enter a search query.");
    return call(c, "search.messages", {
      query: b.query,
      count: 50,
      page: Math.max(1, Number(b.page) || 1),
      sort: "timestamp",
      sort_dir: "desc",
    });
  }
  if (route === "open") {
    if (
      !Array.isArray(b.users) ||
      b.users.length < 1 ||
      b.users.length > 8 ||
      b.users.some((id) => !/^U[A-Z0-9]+$/.test(id))
    )
      throw error("Choose between one and eight Slack users.");
    return call(c, "conversations.open", {
      users: [...new Set(b.users)].join(","),
      return_im: true,
    });
  }
  if (route === "permalink") {
    if (
      !/^[CGD][A-Z0-9]+$/.test(b.channel || "") ||
      !/^\d+\.\d+$/.test(b.ts || "")
    )
      throw error("Choose a Slack message.");
    return call(c, "chat.getPermalink", {
      channel: b.channel,
      message_ts: b.ts,
    });
  }
  if (route === "action") return operate(c, b.id, b.kind, b.payload);
  if (route === "download-link") return {path:createDownloadTicket(await download(c,b.file))};
  if (route === "download") return download(c, b.file);
  throw error("Slack endpoint not found.", 404);
}
