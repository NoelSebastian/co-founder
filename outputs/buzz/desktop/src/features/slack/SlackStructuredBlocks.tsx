import type { ReactNode } from "react";
import type { RichNode } from "./slackRichText";
import { safeAppLink } from "./lovableIntegration";
import { Check, Circle, LoaderCircle } from "lucide-react";

export function SlackStructuredBlocks({
  blocks,
  renderRich,
  renderText,
}: {
  blocks: RichNode[];
  renderRich: (blocks: RichNode[]) => ReactNode;
  renderText: (text: string) => ReactNode;
}) {
  const text = (v: any) => (typeof v === "string" ? v : v?.text || "");
  return (
    <>
      {blocks.slice(0, 100).map((b: any, i) => {
        if (b.type === "task_card") {
          const Icon =
            b.status === "complete"
              ? Check
              : b.status === "in_progress"
                ? LoaderCircle
                : Circle;
          return (
            <div
              key={i}
              className="my-1 flex items-center gap-2 text-xs text-muted-foreground"
              aria-label={`Agent step: ${b.status || "unknown"}`}
            >
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ${b.status === "in_progress" ? "animate-spin" : ""}`}
              />
              {text(b.title)}
            </div>
          );
        }
        if (b.type === "rich_text") return <div key={i}>{renderRich([b])}</div>;
        if (b.type === "table")
          return (
            <div
              key={i}
              className="my-3 max-w-full overflow-x-auto rounded-md border"
              tabIndex={0}
              role="region"
              aria-label="Slack data table"
            >
              <table className="min-w-full border-collapse text-sm">
                <tbody>
                  {(b.rows || []).slice(0, 100).map((row: any[], r: number) => (
                    <tr key={r} className="border-b last:border-0">
                      {row.slice(0, 20).map((cell, c) => {
                        const Cell = r === 0 ? "th" : "td";
                        const align = b.column_settings?.[c]?.align;
                        return (
                          <Cell
                            key={c}
                            scope={r === 0 ? "col" : undefined}
                            className="whitespace-nowrap px-3 py-2 font-normal first:border-l-0 border-l"
                            style={{
                              textAlign:
                                align === "right" || align === "center"
                                  ? align
                                  : "left",
                            }}
                          >
                            {cell.type === "rich_text"
                              ? renderRich([cell])
                              : renderText(text(cell))}
                          </Cell>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        if (b.type === "divider") return <hr key={i} className="my-3" />;
        if (b.type === "header")
          return (
            <div key={i} className="my-2 font-bold">
              {text(b.text)}
            </div>
          );
        if (b.type === "section" || b.type === "markdown")
          return (
            <div key={i} className="my-1">
              {renderText(text(b.text))}
              {b.fields?.map((field: any, n: number) => (
                <div key={n}>{renderText(text(field))}</div>
              ))}
            </div>
          );
        if (b.type === "context")
          return (
            <div key={i} className="my-1 text-xs text-muted-foreground">
              {(b.elements || []).map((e: any, n: number) => (
                <span key={n}>{renderText(text(e))} </span>
              ))}
            </div>
          );
        if (b.type === "image" && safeAppLink(b.image_url))
          return (
            <img
              key={i}
              src={safeAppLink(b.image_url)!}
              alt={b.alt_text || "App attachment"}
              className="my-2 max-h-80 max-w-full rounded object-contain"
              loading="lazy"
            />
          );
        return null;
      })}
    </>
  );
}
