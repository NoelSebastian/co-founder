import type { SlackUser } from "./api";

// Verified from the installed official Lovable Slack app, not a display name.
export const LOVABLE_SLACK_APP_ID = "A0A6M7SEHKJ";
export const LOVABLE_SLACK_SETTINGS = "https://lovable.dev/settings/slack";
export function isLovableUser(user: SlackUser) {
  return (
    !!user.is_bot &&
    !user.deleted &&
    user.profile?.api_app_id === LOVABLE_SLACK_APP_ID
  );
}
export function safeAppLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
