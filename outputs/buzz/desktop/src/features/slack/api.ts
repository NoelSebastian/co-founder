import type { RichNode } from "./slackRichText";
export class SlackRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function slackApi(route: string, body?: unknown) {
  const response = await fetch("http://127.0.0.1:5180/slack/" + route, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new SlackRequestError(
      data.error || "Slack request failed",
      response.status,
    );
  return data;
}
export type SlackUser = {
  id: string;
  name: string;
  is_bot?: boolean;
  deleted?: boolean;
  real_name?: string;
  profile?: {
    display_name?: string;
    real_name?: string;
    image_48?: string;
    api_app_id?: string;
  };
};
export type SlackMessage = {
  blocks?: RichNode[];
  subtype?: string;
  client_msg_id?: string;
  localStatus?: "pending" | "failed" | "uncertain";
  localError?: string;
  ts: string;
  user?: string;
  text?: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users?: string[];
  latest_reply?: string;
  bot_id?: string;
  bot_profile?: { name?: string; icons?: { image_48?: string } };
  agent_session?: { status?: string; agent_bot_user_ids?: string[] };
  edited?: { user?: string; ts?: string };
  files?: { id: string; name: string; mimetype?: string; permalink?: string }[];
  attachments?: {
    fallback?: string;
    title?: string;
    text?: string;
    is_msg_unfurl?: boolean;
    author_id?: string;
    author_name?: string;
    author_icon?: string;
    ts?: string;
    channel_id?: string;
    from_url?: string;
    blocks?: RichNode[];
  }[];
  reactions?: { name: string; count: number; users: string[] }[];
};
export const userName = (u?: SlackUser) =>
  u?.profile?.display_name ||
  u?.real_name ||
  u?.name ||
  u?.id ||
  "Unknown user";
