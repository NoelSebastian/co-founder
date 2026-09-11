import { db } from "../db.mjs";
// A Slack-origin message can settle a lost HTTP response, but only for the
// matching account, destination and original operation. Never resend here.
export async function confirmSlackMessage(team, event) {
  if (
    event?.type !== "message" ||
    !/^[a-f0-9-]{36}$/.test(event.client_msg_id || "") ||
    !/^\d+\.\d+$/.test(event.ts || "") ||
    !event.user ||
    !event.channel
  )
    return;
  await db.query(
    `UPDATE cofounder.slack_operations o SET status='delivered',error=NULL,result=$2,updated_at=now()
 FROM cofounder.slack_connections c WHERE o.connection=c.id AND o.id=$1 AND o.kind='send'
 AND o.status IN ('pending','sending','uncertain') AND c.team=$3 AND c.user_id=$4
 AND o.payload->>'channel'=$5 AND COALESCE(o.payload->>'thread_ts','')=COALESCE($6,'')`,
    [
      event.client_msg_id,
      { ok: true, ts: event.ts, channel: event.channel, message: event },
      team,
      event.user,
      event.channel,
      event.thread_ts || "",
    ],
  );
}
