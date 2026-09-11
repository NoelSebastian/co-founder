// Slack timestamps are decimal identifiers; avoid floating-point rounding.
export function beforeMessage(ts: string): string {
  const [seconds, fraction = "0"] = ts.split(".");
  const value =
    BigInt(seconds) * 1000000n + BigInt(fraction.padEnd(6, "0").slice(0, 6));
  const before = value > 0n ? value - 1n : 0n;
  return `${before / 1000000n}.${String(before % 1000000n).padStart(6, "0")}`;
}
export function firstUnread(
  messages: { ts: string }[],
  cursor: string | null,
): number {
  return cursor ? messages.findIndex((m) => Number(m.ts) > Number(cursor)) : -1;
}
