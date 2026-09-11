import type { JSONContent } from "@tiptap/core";
import { userName, type SlackUser } from "./api";
export function slackMarkdown(node: JSONContent): string {
  if (node.type === "slackMention") return `<@${node.attrs?.id}>`;
  if (node.type === "text") {
    let t = (node.text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    for (const mark of node.marks || []) {
      if (mark.type === "bold") t = "*" + t + "*";
      if (mark.type === "italic") t = "_" + t + "_";
      if (mark.type === "strike") t = "~" + t + "~";
      if (mark.type === "link") t = "<" + mark.attrs?.href + "|" + t + ">";
    }
    return t;
  }
  if (node.type === "hardBreak") return "\n";
  const children = node.content || [];
  if (node.type === "bulletList" || node.type === "orderedList")
    return children
      .map(
        (n, i) =>
          (node.type === "bulletList" ? "• " : `${i + 1}. `) + slackMarkdown(n),
      )
      .join("\n");
  if (node.type === "blockquote")
    return children.map((n) => "> " + slackMarkdown(n)).join("\n");
  return children
    .map(slackMarkdown)
    .join(node.type === "doc" || node.type === "listItem" ? "\n" : "");
}
export function documentFromSlack(
  value: string,
  users: Record<string, SlackUser>,
): JSONContent {
  const inline = (line: string): JSONContent[] =>
    line
      .split(/(<@[A-Z0-9]+>|<https?:[^>]+>|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g)
      .filter(Boolean)
      .flatMap((part): JSONContent[] => {
        if (part.startsWith("<@")) {
          const id = part.slice(2, -1);
          return [
            {
              type: "slackMention",
              attrs: { id, label: users[id] ? userName(users[id]) : id },
            },
          ];
        }
        if (part.startsWith("<http")) {
          const [href, label] = part.slice(1, -1).split("|");
          return [
            {
              type: "text",
              text: label || href,
              marks: [
                {
                  type: "link",
                  attrs: { href: href.replaceAll("&amp;", "&") },
                },
              ],
            },
          ];
        }
        const marks: Record<string, string> = {
          "*": "bold",
          _: "italic",
          "~": "strike",
        };
        if (marks[part[0]] && part.endsWith(part[0]))
          return inline(part.slice(1, -1)).map((node) =>
            node.type === "text"
              ? {
                  ...node,
                  marks: [...(node.marks || []), { type: marks[part[0]] }],
                }
              : node,
          );
        return [
          {
            type: "text",
            text: part
              .replaceAll("&lt;", "<")
              .replaceAll("&gt;", ">")
              .replaceAll("&amp;", "&"),
          },
        ];
      });
  const content: JSONContent[] = [];
  for (const line of value.split("\n")) {
    const list = line.match(/^(• |\d+\. )(.*)$/);
    if (list) {
      const type = line.startsWith("•") ? "bulletList" : "orderedList";
      let group = content.at(-1);
      if (group?.type !== type) {
        group = { type, content: [] };
        content.push(group);
      }
      group.content!.push({
        type: "listItem",
        content: [{ type: "paragraph", content: inline(list[2]) }],
      });
    } else if (line.startsWith("> "))
      content.push({
        type: "blockquote",
        content: [{ type: "paragraph", content: inline(line.slice(2)) }],
      });
    else content.push({ type: "paragraph", content: inline(line) });
  }
  return { type: "doc", content };
}
