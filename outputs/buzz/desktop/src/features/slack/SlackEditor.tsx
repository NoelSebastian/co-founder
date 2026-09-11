import { toSlackBlocks, fromSlackBlocks, type RichNode } from "./slackRichText";
import { useEffect, useState, useRef } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Strikethrough,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Underline,
} from "lucide-react";
import { Node } from "@tiptap/core";
import { type SlackUser } from "./api";
import { slackMarkdown, documentFromSlack } from "./slackFormatting";
const SlackMention = Node.create({
  name: "slackMention",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { id: { default: "" }, label: { default: "" } };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-slack-user]",
        getAttrs: (element) => ({
          id: element.getAttribute("data-slack-user"),
          label: element.textContent?.replace(/^@/, ""),
        }),
      },
    ];
  },
  renderHTML({ node }) {
    return [
      "span",
      { "data-slack-user": node.attrs.id, class: "rounded bg-primary/10 px-1" },
      "@" + node.attrs.label,
    ];
  },
});
export function SlackEditor({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  ariaLabel = "Slack message",
  users = {},
  showFormatting = true,
  initialBlocks,
  onRichChange,
  draftKey,
  emoji = {},
}: {
  ariaLabel?: string;
  showFormatting?: boolean;
  initialBlocks?: RichNode[];
  onRichChange?: (blocks: RichNode[]) => void;
  draftKey?: string;
  emoji?: Record<string, string>;
  users?: Record<string, SlackUser>;
  value: string;
  onChange: (s: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
}) {
  const sendState = useRef({ onSend, disabled });
  sendState.current = { onSend, disabled };
  const [linking, setLinking] = useState(false),
    [url, setUrl] = useState("");
  const restoredDocument = () => {
    try {
      const saved =
        draftKey &&
        JSON.parse(sessionStorage.getItem(draftKey + ":rich") || "null");
      if (saved?.text === value && saved.doc?.type === "doc") return saved.doc;
    } catch {}
    return null;
  };
  const saveDocument = (doc: import("@tiptap/core").JSONContent) => {
    onRichChange?.(toSlackBlocks(doc, emoji));
    if (draftKey)
      try {
        sessionStorage.setItem(
          draftKey + ":rich",
          JSON.stringify({ text: slackMarkdown(doc), doc }),
        );
      } catch {}
  };
  const editor = useEditor(
    {
      extensions: [
        SlackMention,
        StarterKit.configure({
          code: false,
          codeBlock: false,
          underline: {},
          link: { openOnClick: false },
        }),
        Placeholder.configure({ placeholder }),
      ],
      content:
        restoredDocument() ||
        (initialBlocks &&
          fromSlackBlocks(
            initialBlocks,
            Object.fromEntries(
              Object.values(users).map((u) => [
                u.id,
                u.profile?.display_name || u.real_name || u.name,
              ]),
            ),
          )) ||
        documentFromSlack(value, users),
      editorProps: {
        attributes: {
          role: "textbox",
          "aria-label": ariaLabel,
          "aria-multiline": "true",
          class:
            "min-h-16 max-h-48 overflow-y-auto px-3 py-2 text-[15px] leading-[22px] outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_p]:min-h-5",
        },
        handleKeyDown: (_view, e) => {
          if (
            e.key === "Enter" &&
            !e.shiftKey &&
            !e.altKey &&
            !e.isComposing &&
            e.keyCode !== 229
          ) {
            e.preventDefault();
            if (!sendState.current.disabled) sendState.current.onSend();
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        onChange(slackMarkdown(editor.getJSON()));
        saveDocument(editor.getJSON());
      },
    },
    [draftKey],
  );
  useEditorState({
    editor,
    selector: ({ editor }) => editor?.state.selection.from,
  });
  useEffect(() => {
    if (editor && slackMarkdown(editor.getJSON()) !== value) {
      const previous = slackMarkdown(editor.getJSON());
      const restored = restoredDocument();
      if (!restored && previous && value.startsWith(previous)) {
        const appended =
          documentFromSlack(value.slice(previous.length), users).content?.[0]
            ?.content || [];
        editor.commands.insertContentAt(
          editor.state.doc.content.size - 1,
          appended,
          { updateSelection: true },
        );
      } else {
        editor.commands.setContent(
          restored || documentFromSlack(value, users),
          { emitUpdate: false },
        );
      }
      saveDocument(editor.getJSON());
    }
  }, [value, editor]);
  useEffect(() => {
    if (editor) onRichChange?.(toSlackBlocks(editor.getJSON(), emoji));
  }, [editor]);
  if (!editor) return null;
  const actions = [
    ["Bold", Bold, () => editor.chain().focus().toggleBold().run(), "bold"],
    [
      "Italic",
      Italic,
      () => editor.chain().focus().toggleItalic().run(),
      "italic",
    ],
    [
      "Underline",
      Underline,
      () => editor.chain().focus().toggleUnderline().run(),
      "underline",
    ],
    [
      "Strikethrough",
      Strikethrough,
      () => editor.chain().focus().toggleStrike().run(),
      "strike",
    ],
    ["Link", LinkIcon, () => setLinking(!linking), "link"],
    [
      "Numbered list",
      ListOrdered,
      () => editor.chain().focus().toggleOrderedList().run(),
      "orderedList",
    ],
    [
      "Bulleted list",
      List,
      () => editor.chain().focus().toggleBulletList().run(),
      "bulletList",
    ],
    [
      "Quote",
      Quote,
      () => editor.chain().focus().toggleBlockquote().run(),
      "blockquote",
    ],
  ] as const;
  return (
    <>
      <div
        role="toolbar"
        aria-label="Formatting"
        hidden={!showFormatting}
        className={
          showFormatting
            ? "flex items-center gap-1 rounded-t-lg bg-muted/40 px-2 py-1"
            : "hidden"
        }
      >
        {actions.map(([name, Icon, action, mark]) => (
          <button
            key={name}
            type="button"
            aria-label={name}
            aria-pressed={editor.isActive(mark)}
            title={name}
            onMouseDown={(e) => e.preventDefault()}
            onClick={action}
            className={
              "rounded p-1.5 text-muted-foreground hover:bg-muted " +
              (editor.isActive(mark) ? "bg-muted text-foreground" : "")
            }
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      {linking && (
        <div className="flex gap-2 px-3 py-2">
          <input
            aria-label="Link URL"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 rounded border px-2 text-sm"
          />
          <button
            type="button"
            disabled={!/^https?:\/\//.test(url)}
            onClick={() => {
              editor.chain().focus().setLink({ href: url }).run();
              setLinking(false);
              setUrl("");
            }}
          >
            Apply link
          </button>
          <button type="button" onClick={() => setLinking(false)}>
            Cancel
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
    </>
  );
}
