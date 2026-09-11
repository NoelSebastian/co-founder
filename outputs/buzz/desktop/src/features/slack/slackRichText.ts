import type { JSONContent } from "@tiptap/core";
import { slackNativeEmoji } from "./slackEmoji";
export type RichNode = {
  type: string;
  elements?: RichNode[];
  text?: string;
  url?: string;
  user_id?: string;
  name?: string;
  style?: Record<string, boolean> | string;
  indent?: number;
};
export function toSlackBlocks(
  doc: JSONContent,
  emoji: Record<string, string> = {},
): RichNode[] {
  const inline = (nodes: JSONContent[] = []): RichNode[] =>
    nodes.flatMap<RichNode>((n) => {
      if (n.type === "hardBreak") return [{ type: "text", text: "\n" }];
      if (n.type === "slackMention")
        return [{ type: "user", user_id: n.attrs?.id }];
      if (n.type !== "text") return [];
      const style = Object.fromEntries(
        (n.marks || [])
          .filter((m) =>
            ["bold", "italic", "strike", "underline", "code"].includes(m.type),
          )
          .map((m) => [m.type, true]),
      );
      const link = n.marks?.find((m) => m.type === "link");
      if (!link && !style.code && /:[-+\w]+:/.test(n.text || "")) {
        return (n.text || "")
          .split(/(:[-+\w]+:)/g)
          .filter(Boolean)
          .map((text) => {
            let name = text.slice(1, -1);
            if (
              /^:[-+\w]+:$/.test(text) &&
              (slackNativeEmoji[name] || emoji[name])
            ) {
              for (let i = 0; i < 5 && emoji[name]?.startsWith("alias:"); i++)
                name = emoji[name].slice(6);
              return { type: "emoji", name };
            }
            return {
              type: "text",
              text,
              ...(Object.keys(style).length ? { style } : {}),
            };
          });
      }
      return [
        {
          type: link ? "link" : "text",
          text: n.text,
          ...(link ? { url: link.attrs?.href } : {}),
          ...(Object.keys(style).length ? { style } : {}),
        },
      ];
    });
  const elements: RichNode[] = [];
  for (const n of doc.content || []) {
    if (n.type === "bulletList" || n.type === "orderedList")
      elements.push({
        type: "rich_text_list",
        style: n.type === "bulletList" ? "bullet" : "ordered",
        elements: (n.content || []).map((item) => ({
          type: "rich_text_section",
          elements: inline(item.content?.flatMap((p) => p.content || [])),
        })),
      });
    else if (n.type === "blockquote")
      elements.push({
        type: "rich_text_quote",
        elements: inline(
          n.content?.flatMap((p, i) => [
            ...(i ? [{ type: "hardBreak" }] : []),
            ...(p.content || []),
          ]),
        ),
      });
    else
      elements.push({ type: "rich_text_section", elements: inline(n.content) });
  }
  return [
    { type: "rich_text", elements: elements.filter((n) => n.elements?.length) },
  ];
}
export function fromSlackBlocks(
  blocks: RichNode[],
  labels: Record<string, string> = {},
): JSONContent | null {
  const rich = blocks.filter((b) => b.type === "rich_text");
  if (!rich.length) return null;
  const supported = (n: RichNode): boolean =>
    [
      "rich_text",
      "rich_text_section",
      "rich_text_list",
      "rich_text_quote",
      "text",
      "link",
      "user",
      "emoji",
    ].includes(n.type) && (n.elements || []).every(supported);
  if (!rich.every(supported)) return null;
  const inline = (nodes: RichNode[] = []): JSONContent[] =>
    nodes.flatMap<JSONContent>((n) => {
      const marks =
        typeof n.style === "object"
          ? Object.entries(n.style)
              .filter(([, v]) => v)
              .map(([type]) => ({ type }))
          : [];
      if (n.type === "user")
        return [
          {
            type: "slackMention",
            attrs: {
              id: n.user_id,
              label: labels[n.user_id || ""] || n.user_id,
            },
          },
        ];
      if (n.type === "emoji") return [{ type: "text", text: `:${n.name}:` }];
      if (n.type === "link")
        marks.push({ type: "link", attrs: { href: n.url } } as any);
      if (n.type === "text" || n.type === "link")
        return [
          {
            type: "text",
            text: n.text || n.url || "",
            ...(marks.length ? { marks } : {}),
          },
        ];
      return [];
    });
  return {
    type: "doc",
    content: rich.flatMap((b) =>
      (b.elements || []).map((n) => {
        if (n.type === "rich_text_list")
          return {
            type: n.style === "ordered" ? "orderedList" : "bulletList",
            content: (n.elements || []).map((p) => ({
              type: "listItem",
              content: [{ type: "paragraph", content: inline(p.elements) }],
            })),
          };
        const p = { type: "paragraph", content: inline(n.elements) };
        return n.type === "rich_text_quote"
          ? { type: "blockquote", content: [p] }
          : p;
      }),
    ),
  };
}
