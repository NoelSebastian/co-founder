import type { SlackMessage } from "./api";
export const messageDay = (ts: string) =>
  new Date(Number(ts) * 1000).toDateString();
export function groupMessage(
  previous: SlackMessage | undefined,
  current: SlackMessage,
) {
  return (
    !!previous &&
    !!current.user &&
    current.user === previous.user &&
    !current.subtype &&
    !previous.subtype &&
    Number(current.ts) - Number(previous.ts) >= 0 &&
    Number(current.ts) - Number(previous.ts) < 300 &&
    messageDay(current.ts) === messageDay(previous.ts)
  );
}
export function dayLabel(ts: string) {
  const date = new Date(Number(ts) * 1000);
  if (date.toDateString() === new Date().toDateString()) return "Today";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
