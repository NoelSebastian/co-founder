import {confirmSlackMessage} from "./confirmation.mjs";
import { SocketModeClient } from "@slack/socket-mode";
import { db } from "../db.mjs";
import { configuration } from "./store.mjs";
let socket = null,
  token = null;
export const syncState = {
  status: "not_configured",
  connectedAt: null,
  error: null,
};
export async function startSlackSync() {
  const c = await configuration();
  if (!c?.appToken) return;
  if (socket && token === c.appToken) return;
  await socket?.disconnect();
  token = c.appToken;
  socket = new SocketModeClient({ appToken: token, logLevel: "error" });
  syncState.status = "connecting";
  socket.on("connected", () => {
    syncState.status = "connected";
    syncState.connectedAt = new Date().toISOString();
    syncState.error = null;
  });
  socket.on("disconnected", () => {
    syncState.status = "reconnecting";
  });
  socket.on("error", () => {
    syncState.status = "error";
    syncState.error =
      "Slack live connection failed. Check the app-level token and Socket Mode settings.";
  });
  socket.on("slack_event", async ({ body, ack }) => {
    try {
      if (body.event_id && body.team_id) {
        await db.query(
          "INSERT INTO cofounder.slack_events(id,team) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [body.event_id, body.team_id],
        );
        await confirmSlackMessage(body.team_id,body.event);
        if (body.event?.type === "tokens_revoked") {
          for (const id of body.event.tokens?.oauth || [])
            await db.query(
              "UPDATE cofounder.slack_connections SET status='reconnect_required' WHERE team=$1 AND user_id=$2",
              [body.team_id, id],
            );
        }
        if (body.event?.type === "app_uninstalled")
          await db.query(
            "UPDATE cofounder.slack_connections SET status='reconnect_required' WHERE team=$1",
            [body.team_id],
          );
      }
      // Durable invalidation precedes acknowledgement. No message data is
      // copied across users; clients fetch through their own user token.
      await ack();
    } catch {
      syncState.error =
        "Could not persist a Slack update; waiting for redelivery.";
    }
  });
  try {
    await socket.start();
  } catch {
    syncState.status = "error";
    syncState.error = "Could not start Slack Socket Mode. Check the app token.";
  }
}
