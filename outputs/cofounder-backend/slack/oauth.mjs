import { WebClient } from "@slack/web-api";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "../db.mjs";
import { humans } from "../config.mjs";
import { configuration, seal, hash, error } from "./store.mjs";
export const scopes = [
  "channels:read",
  "channels:history",
  "channels:write",
  "groups:read",
  "groups:history",
  "groups:write",
  "im:read",
  "im:history",
  "im:write",
  "mpim:read",
  "mpim:history",
  "mpim:write",
  "chat:write",
  "users:read",
  "usergroups:read",
  "reactions:read",
  "reactions:write",
  "emoji:read",
  "files:read",
  "files:write",
  "search:read",
];
export function manifest(redirect) {
  return {
    display_information: {
      name: "Co-founder Slack",
      description: "Personal Slack messaging inside Co-founder",
      background_color: "#24292e",
    },
    oauth_config: { redirect_urls: [redirect], scopes: { user: scopes } },
    settings: {
      socket_mode_enabled: true,
      event_subscriptions: {
        user_events: [
          "message.channels",
          "message.groups",
          "message.im",
          "message.mpim",
          "reaction_added",
          "reaction_removed",
          "member_left_channel",
          "member_joined_channel",
          "channel_rename",
          "channel_archive",
          "channel_unarchive",
          "user_change",
          "emoji_changed",
        ],
      },
      org_deploy_enabled: false,
      token_rotation_enabled: false,
    },
  };
}
export async function configure(actor, b) {
  if (actor !== humans[0].pubkey)
    throw error(
      "Only the workspace owner can configure the Slack application.",
      403,
    );
  const old = (await configuration()) || {};
  const c = { ...old };
  for (const k of ["clientId", "clientSecret", "appToken", "redirectUri"])
    if (typeof b[k] === "string" && b[k].trim()) c[k] = b[k].trim();
  if (!/^\d+\.\d+$/.test(c.clientId || ""))
    throw error("Enter the Slack Client ID.");
  if (!c.clientSecret || !c.appToken?.startsWith("xapp-"))
    throw error(
      "Enter the Slack Client Secret and app-level Socket Mode token.",
    );
  let u;
  try {
    u = new URL(c.redirectUri);
  } catch {
    throw error("Enter a valid HTTPS OAuth callback URL.");
  }
  if (
    u.protocol !== "https:" ||
    u.pathname !== "/slack/callback" ||
    u.search ||
    u.hash
  )
    throw error("Callback must be HTTPS and end in /slack/callback.");
  await db.query(
    "INSERT INTO cofounder.slack_config(id,secret) VALUES(true,$1) ON CONFLICT(id) DO UPDATE SET secret=excluded.secret",
    [seal(c)],
  );
  return { ok: true };
}
export async function begin(actor, returnOrigin) {
  const c = await configuration();
  if (!c) throw error("Configure the Slack application first.", 409);
  const state = randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO cofounder.slack_oauth VALUES($1,$2,$3,now()+interval '10 minutes')",
    [hash(state), actor, returnOrigin],
  );
  const u = new URL("https://slack.com/oauth/v2/authorize");
  u.search = new URLSearchParams({
    client_id: c.clientId,
    user_scope: scopes.join(","),
    redirect_uri: c.redirectUri,
    state,
  }).toString();
  return { url: u.href };
}
export async function callback(u) {
  const state = u.searchParams.get("state") || "";
  if (!/^[a-f0-9]{64}$/.test(state))
    throw error("Invalid or expired Slack connection request.");
  const r = await db.query(
    "DELETE FROM cofounder.slack_oauth WHERE state=$1 AND expires>now() RETURNING *",
    [hash(state)],
  );
  if (!r.rowCount)
    throw error(
      "This Slack connection request expired or was already used. Start again in the app.",
    );
  if (u.searchParams.has("error"))
    throw error("Slack authorization was cancelled or denied.");
  const c = await configuration();
  const client = new WebClient(undefined, {
    retryConfig: { retries: 0 },
    timeout: 20000,
  });
  const result = await client.oauth.v2.access({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    code: u.searchParams.get("code"),
    redirect_uri: c.redirectUri,
  });
  const user = result.authed_user;
  if (!user?.access_token || user.token_type !== "user")
    throw error(
      "Slack did not grant a personal user token. Bot access cannot be substituted.",
    );
  const auth = await new WebClient(user.access_token).auth.test();
  if (
    auth.user_id !== user.id ||
    auth.team_id !== result.team?.id ||
    auth.bot_id
  )
    throw error("Slack identity validation failed.");
  await db.query(
    `INSERT INTO cofounder.slack_connections(id,actor,team,user_id,team_name,secret,scopes) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(actor,team) DO UPDATE SET user_id=excluded.user_id,team_name=excluded.team_name,secret=excluded.secret,scopes=excluded.scopes,status='connected'`,
    [
      randomUUID(),
      r.rows[0].actor,
      auth.team_id,
      auth.user_id,
      result.team.name || auth.team,
      seal({
        accessToken: user.access_token,
        refreshToken: user.refresh_token,
        expiresAt: user.expires_in ? Date.now() + user.expires_in * 1000 : null,
      }),
      user.scope || "",
    ],
  );
  return r.rows[0].return_origin + "/#/slack";
}
