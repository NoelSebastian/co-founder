import { safeAppLink } from "./lovableIntegration";
import type { RichNode } from "./slackRichText";

// Slack's public Web API cannot invoke another app's interactive callbacks.
// Preserve real URL buttons, and route callback-only controls to Slack.
export function SlackAppActions({
  blocks,
  onOpenSlack,
}: {
  blocks?: RichNode[];
  onOpenSlack: () => void;
}) {
  const controls = (blocks || [])
    .slice(0, 100)
    .flatMap((block: any) => [
      ...(block.type === "actions" ? block.elements || [] : []),
      ...(block.accessory ? [block.accessory] : []),
    ])
    .filter((b: any) => b.type === "button")
    .slice(0, 25);
  if (!controls.length) return null;
  return (
    <div className="my-2 flex flex-wrap gap-2" aria-label="App actions">
      {controls.map((control: any, i: number) => {
        const label =
          typeof control.text === "string"
            ? control.text
            : control.text?.text || "Review request";
        const url = safeAppLink(control.url);
        const className =
          "rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted";
        return url ? (
          <a
            className={className}
            href={url}
            target="_blank"
            rel="noreferrer"
            key={i}
          >
            {label}
          </a>
        ) : (
          <button
            className={className}
            key={i}
            onClick={onOpenSlack}
            title="This app action must be completed in Slack"
          >
            {label} · in Slack
          </button>
        );
      })}
    </div>
  );
}
