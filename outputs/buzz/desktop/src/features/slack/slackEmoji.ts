import data from "@emoji-mart/data/sets/15/native.json" with { type: "json" };
const catalog = data as {
  emojis: Record<string, { skins: { native: string }[] }>;
  aliases?: Record<string, string>;
};
export const slackNativeEmoji: Record<string, string> = Object.fromEntries(
  Object.entries(catalog.emojis).map(([name, e]) => [
    name,
    e.skins[0]?.native || "",
  ]),
);
for (const [alias, name] of Object.entries(catalog.aliases || {}))
  if (slackNativeEmoji[name]) slackNativeEmoji[alias] = slackNativeEmoji[name];
Object.assign(slackNativeEmoji, {
  thumbsup: "👍",
  thumbsdown: "👎",
  simple_smile: "🙂",
});
