import { beforeMessage } from "./readCursor";
import { SlackAppActions } from "./SlackAppActions";
import { SlackStructuredBlocks } from "./SlackStructuredBlocks";
import { SlackAttachment } from "./SlackAttachment";
import type { JSONContent } from "@tiptap/core";
import { fromSlackBlocks, type RichNode } from "./slackRichText";
import { slackNativeEmoji } from "./slackEmoji";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/shared/ui/context-menu";
import { SlackEditor } from "./SlackEditor";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import {
  UserRound,
  SmilePlus,
  MessageCircle,
  Forward,
  Bookmark,
  MoreVertical,
  Link,
  Pencil,
  ExternalLink,
  Copy,
  Clock,
  BellOff,
  Mail,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";
import { slackApi } from "./api";
import { Button } from "@/shared/ui/button";
import { type SlackMessage as Message, type SlackUser, userName } from "./api";
const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
export function SlackText({
  text,
  users,
  channels,
  emoji = {},
}: {
  emoji?: Record<string, string>;
  text: string;
  users: Record<string, SlackUser>;
  channels: Record<string, string>;
}) {
  // Render quote blocks separately so the visible quote marker matches Slack.
  if (!text.includes("```") && /(^|\n)(?:>|&gt;) ?/.test(text)) {
    const groups: { quote: boolean; text: string }[] = [];
    for (const line of text.split("\n")) {
      const quote = /^(?:>|&gt;) ?/.test(line);
      const body = quote ? line.replace(/^(?:>|&gt;) ?/, "") : line;
      const previous = groups.at(-1);
      if (previous?.quote === quote) previous.text += "\n" + body;
      else groups.push({ quote, text: body });
    }
    return (
      <>
        {groups.map((g, i) =>
          g.quote ? (
            <blockquote
              key={i}
              className="my-1 border-l-4 border-muted-foreground/30 pl-3"
            >
              <SlackText
                text={g.text}
                users={users}
                channels={channels}
                emoji={emoji}
              />
            </blockquote>
          ) : (
            <div key={i}>
              <SlackText
                text={g.text}
                users={users}
                channels={channels}
                emoji={emoji}
              />
            </div>
          ),
        )}
      </>
    );
  }
  // Slack mrkdwn is parsed as text and React elements, never injected HTML.
  const parts = text.split(
    /(<[^>]+>|```[\s\S]*?```|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g,
  );
  return (
    <>
      {parts.map((p, i): ReactNode => {
        if (p.startsWith("<@")) {
          const id = p.slice(2, -1).split("|")[0];
          return (
            <span key={i} className="rounded bg-primary/10 px-1">
              @
              {userName(users[id]) === "Unknown user"
                ? id
                : userName(users[id])}
            </span>
          );
        }
        if (p.startsWith("<#")) {
          const [id, label] = p.slice(2, -1).split("|");
          return <span key={i}>#{channels[id] || label || id}</span>;
        }
        if (p.startsWith("<!"))
          return <span key={i}>@{p.slice(2, -1).split("|").at(-1)}</span>;
        if (p.startsWith("<")) {
          const [url, label] = p.slice(1, -1).split("|");
          if (/^https?:\/\//.test(url))
            return (
              <a
                key={i}
                href={decode(url)}
                target="_blank"
                rel="noreferrer"
                className="underline text-primary"
              >
                {decode(label || url)}
              </a>
            );
        }
        if (p.startsWith("```"))
          return (
            <pre key={i} className="overflow-auto rounded bg-muted p-2">
              {p.slice(3, -3)}
            </pre>
          );
        if (p.startsWith("`"))
          return (
            <code key={i} className="bg-muted">
              {p.slice(1, -1)}
            </code>
          );
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2)
          return (
            <strong key={i}>
              <SlackText
                text={p.slice(1, -1)}
                users={users}
                channels={channels}
                emoji={emoji}
              />
            </strong>
          );
        if (p.startsWith("_") && p.endsWith("_") && p.length > 2)
          return (
            <em key={i}>
              <SlackText
                text={p.slice(1, -1)}
                users={users}
                channels={channels}
                emoji={emoji}
              />
            </em>
          );
        if (p.startsWith("~") && p.endsWith("~") && p.length > 2)
          return (
            <s key={i}>
              <SlackText
                text={p.slice(1, -1)}
                users={users}
                channels={channels}
                emoji={emoji}
              />
            </s>
          );
        return decode(p)
          .split(/(:[a-zA-Z0-9_+\-]+:)/g)
          .map((part, j) => {
            if (!part.startsWith(":")) return part;
            let name = part.slice(1, -1);
            let source = emoji[name];
            for (let n = 0; n < 5 && source?.startsWith("alias:"); n++) {
              name = source.slice(6);
              source = emoji[name];
            }
            if (/^https:\/\//.test(source || ""))
              return (
                <img
                  key={`${i}-${j}`}
                  src={source}
                  alt={part}
                  title={part}
                  className="inline-block h-5 w-5 align-text-bottom object-contain"
                />
              );
            return slackNativeEmoji[name] || part;
          });
      })}
    </>
  );
}
export function RichMessage({
  blocks,
  text,
  users,
  channels,
  emoji,
}: {
  blocks?: RichNode[];
  text: string;
  users: Record<string, SlackUser>;
  channels: Record<string, string>;
  emoji: Record<string, string>;
}) {
  if (
    blocks?.some((b) =>
      [
        "table",
        "section",
        "header",
        "context",
        "image",
        "markdown",
        "divider",
        "task_card",
      ].includes(b.type),
    )
  ) {
    return (
      <SlackStructuredBlocks
        blocks={blocks}
        renderRich={(parts) => (
          <RichMessage
            blocks={parts}
            text=""
            users={users}
            channels={channels}
            emoji={emoji}
          />
        )}
        renderText={(value) => (
          <SlackText
            text={value}
            users={users}
            channels={channels}
            emoji={emoji}
          />
        )}
      />
    );
  }
  const doc =
    blocks &&
    fromSlackBlocks(
      blocks,
      Object.fromEntries(Object.values(users).map((u) => [u.id, userName(u)])),
    );
  if (!doc)
    return (
      <SlackText text={text} users={users} channels={channels} emoji={emoji} />
    );
  const render = (n: JSONContent, key: number): ReactNode => {
    if (n.type === "text") {
      let child: ReactNode = n.text
        ?.split(/(:[-+\w]+:)/g)
        .map((part, i) =>
          /^:[-+\w]+:$/.test(part) ? (
            <SlackText
              key={i}
              text={part}
              users={users}
              channels={channels}
              emoji={emoji}
            />
          ) : (
            part
          ),
        );
      for (const mark of n.marks || []) {
        if (mark.type === "bold") child = <strong>{child}</strong>;
        if (mark.type === "italic") child = <em>{child}</em>;
        if (mark.type === "underline") child = <u>{child}</u>;
        if (mark.type === "strike") child = <s>{child}</s>;
        if (mark.type === "code")
          child = <code className="rounded bg-muted px-1">{child}</code>;
        if (mark.type === "link" && /^https?:\/\//.test(mark.attrs?.href || ""))
          child = (
            <a
              href={mark.attrs?.href}
              target="_blank"
              rel="noreferrer"
              className="text-[#1264a3] underline"
            >
              {child}
            </a>
          );
      }
      return <span key={key}>{child}</span>;
    }
    if (n.type === "slackMention")
      return (
        <span key={key} className="rounded bg-primary/10 px-1">
          @{n.attrs?.label}
        </span>
      );
    const children = n.content?.map(render);
    if (n.type === "bulletList")
      return (
        <ul key={key} className="list-disc pl-5">
          {children}
        </ul>
      );
    if (n.type === "orderedList")
      return (
        <ol key={key} className="list-decimal pl-5">
          {children}
        </ol>
      );
    if (n.type === "listItem") return <li key={key}>{children}</li>;
    if (n.type === "blockquote")
      return (
        <blockquote
          key={key}
          className="border-l-4 border-muted-foreground/30 pl-3"
        >
          {children}
        </blockquote>
      );
    return (
      <span key={key}>
        {key > 0 && <br />}
        {children}
      </span>
    );
  };
  return <>{doc.content?.map(render)}</>;
}
export function SlackMessageRow({
  message: m,
  connection,
  channelId,
  users,
  channels,
  me,
  emoji,
  onAction,
  onThread,
  showThreadActions = true,
  compact = false,
  onRestore,
  onDismiss,
  onFile,
}: {
  message: Message;
  connection: string;
  channelId: string;
  users: Record<string, SlackUser>;
  channels: Record<string, string>;
  me: string;
  emoji: Record<string, string>;
  onAction: (kind: string, p: Record<string, unknown>) => Promise<boolean>;
  onThread: (ts: string) => void;
  showThreadActions?: boolean;
  compact?: boolean;
  onRestore?: () => void;
  onDismiss?: () => void;
  onFile: (id: string, preview: boolean) => void;
}) {
  const [editing, setEditing] = useState(false),
    [value, setValue] = useState(m.text || ""),
    [reacting, setReacting] = useState(false),
    [reaction, setReaction] = useState(""),
    [confirm, setConfirm] = useState(false),
    [sharing, setSharing] = useState(false),
    [destination, setDestination] = useState(""),
    [forwardComment, setForwardComment] = useState(""),
    [destinationQuery, setDestinationQuery] = useState(""),
    [notice, setNotice] = useState(""),
    [working, setWorking] = useState(false);
  const editBlocks = useRef<RichNode[] | undefined>(m.blocks);
  const openPickerAfterMenu = useRef(false);
  const shareRequest = useRef<{ target: string; id: string } | null>(null);
  const quickEmoji: Record<string, string> = {
    white_check_mark: "✅",
    eyes: "👀",
    raised_hands: "🙌",
    thumbsup: "👍",
    heart: "❤️",
    tada: "🎉",
  };
  async function saveEdit() {
    if (!value.trim() || working) return;
    setWorking(true);
    setNotice("");
    try {
      const delivered = await onAction("edit", {
        ts: m.ts,
        text: value,
        blocks: editBlocks.current,
        thread_ts: m.thread_ts,
      });
      if (delivered) setEditing(false);
      else
        setNotice(
          "Edit not confirmed. Your changes are preserved; check the error before retrying.",
        );
    } catch (e) {
      setNotice(String(e));
    } finally {
      setWorking(false);
    }
  }
  async function messageLink() {
    const r = await slackApi("permalink", {
      connection,
      channel: channelId,
      ts: m.ts,
    });
    return r.permalink as string;
  }
  async function linkAction(open = false) {
    try {
      setNotice("");
      const url = await messageLink();
      if (open) window.open(url, "_blank", "noopener,noreferrer");
      else {
        await navigator.clipboard.writeText(url);
        setNotice("Link copied");
      }
    } catch (e) {
      setNotice(String(e));
    }
  }
  async function share() {
    if (!destination || working) return;
    setWorking(true);
    try {
      const url = await messageLink();
      const fingerprint = JSON.stringify([destination, forwardComment]);
      if (!shareRequest.current || shareRequest.current.target !== fingerprint)
        shareRequest.current = { target: fingerprint, id: crypto.randomUUID() };
      const r = await slackApi("action", {
        connection,
        id: shareRequest.current.id,
        kind: "send",
        payload: {
          channel: destination,
          text: [forwardComment.trim(), url].filter(Boolean).join("\n"),
          unfurl_links: true,
        },
      });
      if (r.status === "failed") shareRequest.current = null;
      if (r.status !== "delivered")
        throw Error(
          r.error || "Delivery not confirmed; check Slack before retrying.",
        );
      setSharing(false);
      setForwardComment("");
      setNotice("Shared in Slack");
    } catch (e) {
      setNotice(String(e));
    } finally {
      setWorking(false);
    }
  }

  const user =
    users[m.user || ""] ||
    (m.bot_profile
      ? {
          id: m.user || m.bot_id || "",
          name: m.bot_profile.name || "Slack app",
          is_bot: true,
          profile: { image_48: m.bot_profile.icons?.image_48 },
        }
      : undefined);
  let time = "";
  try {
    time = new Date(Number(m.ts) * 1000).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {}
  const own = m.user === me;
  function canonicalEmoji(name: string) {
    for (let i = 0; i < 5 && emoji[name]?.startsWith("alias:"); i++)
      name = emoji[name].slice(6);
    return name;
  }
  function emojiUrl(name: string): string | undefined {
    let v = emoji[name];
    for (let n = 0; n < 5 && v?.startsWith("alias:"); n++)
      v = emoji[v.slice(6)];
    return /^https:\/\//.test(v || "") ? v : undefined;
  }
  const renderMenuItems = (context: boolean) => {
    const Item = context ? ContextMenuItem : DropdownMenuItem;
    const Separator = context ? ContextMenuSeparator : DropdownMenuSeparator;
    return (
      <>
        {" "}
        <Item
          onSelect={() => {
            openPickerAfterMenu.current = true;
          }}
        >
          <SmilePlus className="mr-2 h-4 w-4" />
          Add reaction…<span className="ml-auto text-xs opacity-60">R</span>
        </Item>
        {showThreadActions && (
          <Item onSelect={() => onThread(m.thread_ts || m.ts)}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Reply in thread
            <span className="ml-auto text-xs opacity-60">T</span>
          </Item>
        )}
        <Item
          onSelect={() => {
            shareRequest.current = null;
            setSharing(true);
          }}
        >
          <Forward className="mr-2 h-4 w-4" />
          Forward message…
          <span className="ml-auto text-xs opacity-60">F</span>
        </Item>
        <Item
          onSelect={() => void linkAction(true)}
          title="Complete in Slack; no supported Later API"
        >
          <Bookmark className="mr-2 h-4 w-4" />
          Save for later in Slack
          <span className="ml-auto text-xs opacity-60">A</span>
        </Item>
        {own && (
          <>
            <Separator />
            <Item
              onSelect={() => {
                setValue(m.text || "");
                setEditing(true);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit message
              <span className="ml-auto text-xs opacity-60">E</span>
            </Item>
          </>
        )}
        <Separator />
        <Item
          onSelect={() =>
            m.thread_ts && m.thread_ts !== m.ts
              ? void linkAction(true)
              : void onAction("mark", { ts: beforeMessage(m.ts) })
          }
        >
          <Mail className="mr-2 h-4 w-4" />
          {m.thread_ts && m.thread_ts !== m.ts
            ? "Mark thread unread in Slack"
            : "Mark unread"}
          <span className="ml-auto text-xs opacity-60">U</span>
        </Item>
        <Item onSelect={() => void linkAction(true)} title="Complete in Slack">
          <Clock className="mr-2 h-4 w-4" />
          Remind me in Slack
          <ExternalLink className="ml-auto h-3 w-3" />
        </Item>
        <Item onSelect={() => void linkAction(true)} title="Complete in Slack">
          <BellOff className="mr-2 h-4 w-4" />
          Manage reply notifications in Slack
        </Item>
        <Separator />
        <Item onSelect={() => void linkAction()}>
          <Link className="mr-2 h-4 w-4" />
          Copy link<span className="ml-auto text-xs opacity-60">L</span>
        </Item>
        <Item
          onSelect={() => {
            void navigator.clipboard.writeText(m.text || "").then(
              () => setNotice("Message copied"),
              (e) => setNotice(String(e)),
            );
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy message<span className="ml-auto text-xs opacity-60">⌘C</span>
        </Item>
        {own && (
          <>
            <Separator />
            <Item
              className="text-destructive"
              onSelect={() => setConfirm(true)}
            >
              Delete message…
              <span className="ml-auto text-xs opacity-60">delete</span>
            </Item>
          </>
        )}
      </>
    );
  };
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={!!m.localStatus}>
        <article
          tabIndex={0}
          aria-label={
            m.localStatus === "pending"
              ? "Message awaiting Slack confirmation"
              : undefined
          }
          onKeyDown={(e) => {
            if (m.localStatus) return;
            const target = e.target as HTMLElement;
            if (target.closest("input,textarea,[contenteditable=true]")) return;
            if (e.metaKey || e.ctrlKey) {
              if (
                e.key.toLowerCase() === "c" &&
                !window.getSelection()?.toString()
              ) {
                e.preventDefault();
                void navigator.clipboard.writeText(m.text || "");
              }
              return;
            }
            if (e.altKey) return;
            switch (e.key.toLowerCase()) {
              case "u":
                e.preventDefault();
                if (m.thread_ts && m.thread_ts !== m.ts) void linkAction(true);
                else void onAction("mark", { ts: beforeMessage(m.ts) });
                break;
              case "r":
                e.preventDefault();
                setReacting(true);
                break;
              case "t":
                e.preventDefault();
                if (showThreadActions) onThread(m.thread_ts || m.ts);
                break;
              case "f":
                e.preventDefault();
                shareRequest.current = null;
                setSharing(true);
                break;
              case "a":
                e.preventDefault();
                void linkAction(true);
                break;
              case "e":
                if (own) {
                  e.preventDefault();
                  setValue(m.text || "");
                  setEditing(true);
                }
                break;
              case "l":
                e.preventDefault();
                void linkAction();
                break;
              case "delete":
                if (own) {
                  e.preventDefault();
                  setConfirm(true);
                }
                break;
            }
          }}
          className={
            "group relative flex gap-2 px-5 hover:bg-[#f8f8f8] dark:hover:bg-muted/40 focus-within:bg-muted/30 " +
            (compact ? "py-0.5" : "pt-3 pb-1")
          }
        >
          <div
            hidden={!!m.localStatus}
            role="toolbar"
            aria-label="Message actions"
            className="absolute right-2 top-0 z-20 flex -translate-y-1/3 items-center gap-0.5 rounded-xl border border-border bg-background p-1 shadow-sm opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto"
          >
            {Object.entries(quickEmoji)
              .slice(0, 3)
              .map(([name, glyph]) => {
                const selected = !!m.reactions?.some(
                  (r) => r.name === name && r.users.includes(me),
                );
                return (
                  <button
                    type="button"
                    key={name}
                    title={name.replaceAll("_", " ")}
                    aria-label={`${selected ? "Remove" : "Add"} ${name} reaction`}
                    aria-pressed={selected}
                    className={
                      "flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-muted " +
                      (selected ? "bg-primary/10" : "")
                    }
                    onClick={() =>
                      onAction(selected ? "unreact" : "react", {
                        ts: m.ts,
                        name,
                      })
                    }
                  >
                    {glyph}
                  </button>
                );
              })}
            <Popover open={reacting} onOpenChange={setReacting}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Add reaction"
                  title="Add reaction"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <SmilePlus className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 rounded-lg p-3">
                <input
                  autoFocus
                  aria-label="Find an emoji"
                  placeholder="Find an emoji"
                  value={reaction}
                  onChange={(e) => setReaction(e.target.value)}
                  className="mb-3 w-full rounded border bg-background px-3 py-2 text-sm"
                />
                <p className="mb-2 text-xs text-muted-foreground">Emoji</p>
                <div className="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto">
                  {[
                    ...new Set([
                      ...Object.keys(quickEmoji),
                      ...Object.keys(slackNativeEmoji),
                      ...Object.keys(emoji),
                    ]),
                  ]
                    .filter((n) =>
                      n.includes(reaction.toLowerCase().replaceAll(" ", "_")),
                    )
                    .map((name) => (
                      <button
                        key={name}
                        title={name}
                        aria-label={"React with " + name}
                        className="flex h-8 w-8 items-center justify-center rounded text-xl hover:bg-muted"
                        onClick={() => {
                          onAction(
                            m.reactions?.some(
                              (r) =>
                                r.name === canonicalEmoji(name) &&
                                r.users.includes(me),
                            )
                              ? "unreact"
                              : "react",
                            { ts: m.ts, name: canonicalEmoji(name) },
                          );
                          setReacting(false);
                          setReaction("");
                        }}
                      >
                        {emojiUrl(name) ? (
                          <img
                            src={emojiUrl(name)}
                            alt={name}
                            className="h-6 w-6"
                          />
                        ) : (
                          slackNativeEmoji[canonicalEmoji(name)] || name
                        )}
                      </button>
                    ))}
                </div>
              </PopoverContent>
            </Popover>
            {showThreadActions && (
              <button
                type="button"
                aria-label="Reply in thread"
                title="Reply in thread"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                onClick={() => onThread(m.thread_ts || m.ts)}
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              aria-label="Forward message"
              title="Forward message"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              onClick={() => {
                shareRequest.current = null;
                setSharing(true);
              }}
            >
              <Forward className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Save for later in Slack"
              title="Save for later opens Slack; Slack does not expose a synchronization API"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              onClick={() => void linkAction(true)}
            >
              <Bookmark className="h-4 w-4" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More message actions"
                  title="More actions"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                onCloseAutoFocus={(e) => {
                  if (openPickerAfterMenu.current) {
                    e.preventDefault();
                    openPickerAfterMenu.current = false;
                    setTimeout(() => setReacting(true), 50);
                  }
                }}
                align="end"
                className="w-[300px] rounded-md py-2 text-sm [&_[role=menuitem]]:rounded-none [&_[role=menuitem]]:px-5 [&_[role=menuitem]]:py-1.5 [&_[role=menuitem]]:focus:bg-[#1264a3] [&_[role=menuitem]]:focus:text-white"
              >
                {renderMenuItems(false)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {compact ? (
            <time
              title={new Date(Number(m.ts) * 1000).toLocaleString()}
              className="w-9 shrink-0 self-start text-[10px] leading-[22px] text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {time}
            </time>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted text-xs">
              {user?.profile?.image_48 ? (
                <img
                  src={user.profile.image_48}
                  alt=""
                  className="h-9 w-9 rounded"
                />
              ) : (
                userName(user).slice(0, 2)
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {!compact && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] leading-[22px] font-bold">
                  {user ? userName(user) : m.user || "Slack app"}
                </span>
                <time
                  title={new Date(Number(m.ts) * 1000).toLocaleString()}
                  className="text-xs text-muted-foreground"
                >
                  {time}
                </time>
              </div>
            )}
            {m.subtype === "thread_broadcast" && showThreadActions && (
              <button
                className="mb-1 block text-xs text-muted-foreground hover:underline"
                onClick={() => onThread(m.thread_ts || m.ts)}
              >
                Replied to a thread · View thread
              </button>
            )}
            {editing ? (
              <div className="space-y-2">
                <SlackEditor
                  emoji={emoji}
                  users={users}
                  initialBlocks={m.blocks}
                  onRichChange={(blocks) => {
                    editBlocks.current = blocks;
                  }}
                  ariaLabel="Edit message"
                  value={value}
                  onChange={setValue}
                  placeholder="Edit message"
                  disabled={working || !value.trim()}
                  onSend={() => void saveEdit()}
                />
                <Button
                  size="sm"
                  disabled={working || !value.trim()}
                  onClick={() => void saveEdit()}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setNotice("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="whitespace-pre-wrap break-words text-[15px] leading-[22px]">
                <RichMessage
                  blocks={m.blocks}
                  text={m.text || ""}
                  emoji={emoji}
                  users={users}
                  channels={channels}
                />
                {!!m.edited && (!m.edited.user || m.edited.user === m.user) && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (edited)
                  </span>
                )}
              </div>
            )}
            <SlackAppActions
              blocks={m.blocks}
              onOpenSlack={() => void linkAction(true)}
            />
            {m.localStatus && m.localStatus !== "pending" && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {m.localError || "Message not sent"}
                {m.localStatus === "failed" && onRestore && (
                  <button className="ml-2 underline" onClick={onRestore}>
                    Edit and retry
                  </button>
                )}
                {onDismiss && (
                  <button className="ml-2 underline" onClick={onDismiss}>
                    Dismiss
                  </button>
                )}
              </p>
            )}
            {m.attachments?.map((a, i) => (
              <blockquote
                key={i}
                className={
                  a.is_msg_unfurl
                    ? "my-2 max-w-[720px] rounded-xl border border-border p-3 text-[15px] leading-[22px]"
                    : "my-2 border-l-4 border-muted-foreground/30 pl-3 text-[15px] leading-[22px]"
                }
              >
                {a.is_msg_unfurl ? (
                  <>
                    <div className="mb-2 flex items-start gap-2">
                      {(users[a.author_id || ""]?.profile?.image_48 ||
                        a.author_icon) && (
                        <img
                          className="h-9 w-9 rounded"
                          alt=""
                          src={
                            users[a.author_id || ""]?.profile?.image_48 ||
                            a.author_icon
                          }
                        />
                      )}
                      <div>
                        <strong>
                          {a.author_id
                            ? userName(users[a.author_id])
                            : a.author_name}
                        </strong>
                        {a.ts && (
                          <time className="ml-2 text-xs text-muted-foreground">
                            {new Date(Number(a.ts) * 1000).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </time>
                        )}
                        {a.from_url && /^https:\/\//.test(a.from_url) && (
                          <a
                            href={a.from_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs text-muted-foreground hover:underline"
                          >
                            Posted in{" "}
                            {channels[a.channel_id || ""] ||
                              "Slack conversation"}
                          </a>
                        )}
                      </div>
                    </div>
                    <RichMessage
                      blocks={a.blocks}
                      text={a.text || a.fallback || ""}
                      users={users}
                      channels={channels}
                      emoji={emoji}
                    />
                  </>
                ) : (
                  <>
                    <strong>{a.title}</strong>
                    <SlackText
                      text={a.text || a.fallback || ""}
                      users={users}
                      channels={channels}
                      emoji={emoji}
                    />
                  </>
                )}
              </blockquote>
            ))}
            {m.files?.map((f) => (
              <SlackAttachment
                key={f.id}
                file={f}
                connection={connection}
                onFile={onFile}
              />
            ))}
            <div className="mt-1 flex flex-wrap gap-2">
              {m.reactions?.map((r) => (
                <button
                  key={r.name}
                  aria-label={`${r.users.includes(me) ? "Remove" : "Add"} ${r.name} reaction`}
                  className={
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs " +
                    (r.users.includes(me) ? "bg-primary/10" : "")
                  }
                  onClick={() =>
                    onAction(r.users.includes(me) ? "unreact" : "react", {
                      ts: m.ts,
                      name: r.name,
                    })
                  }
                >
                  {emojiUrl(r.name) ? (
                    <img
                      src={emojiUrl(r.name)}
                      alt={r.name}
                      className="h-4 w-4"
                    />
                  ) : (
                    slackNativeEmoji[r.name] || ":" + r.name + ":"
                  )}{" "}
                  {r.count}
                </button>
              ))}
            </div>
            {showThreadActions && !!m.reply_count && (
              <button
                className="group/replies mt-1 flex min-h-7 items-center gap-2 rounded px-0 text-left hover:bg-muted/50"
                aria-label={`${m.reply_count} ${m.reply_count === 1 ? "reply" : "replies"}`}
                onClick={() => onThread(m.thread_ts || m.ts)}
              >
                <span className="flex shrink-0 items-center gap-1">
                  {(m.reply_users?.length
                    ? m.reply_users.slice(0, 3)
                    : [""]
                  ).map((id, i) => {
                    const participant = users[id];
                    return participant?.profile?.image_48 ? (
                      <img
                        key={id}
                        src={participant.profile.image_48}
                        alt={userName(participant)}
                        className="h-6 w-6 rounded object-cover"
                      />
                    ) : (
                      <span
                        key={id || i}
                        className="flex h-6 w-6 items-center justify-center rounded bg-muted"
                        title={
                          participant
                            ? userName(participant)
                            : "Thread participants"
                        }
                      >
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                      </span>
                    );
                  })}
                </span>
                <span className="shrink-0 text-[13px] font-bold leading-[18px] text-[#2d63a0] group-hover/replies:underline">
                  {m.reply_count} {m.reply_count === 1 ? "reply" : "replies"}
                </span>
                {m.latest_reply && (
                  <time
                    dateTime={new Date(
                      Number(m.latest_reply) * 1000,
                    ).toISOString()}
                    className="truncate text-[13px] font-normal leading-[18px] text-[#616061]"
                  >
                    Last reply{" "}
                    {new Date(Number(m.latest_reply) * 1000).toDateString() ===
                    new Date().toDateString()
                      ? "today"
                      : new Date(
                          Number(m.latest_reply) * 1000,
                        ).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                    at{" "}
                    {new Date(Number(m.latest_reply) * 1000).toLocaleTimeString(
                      undefined,
                      { hour: "2-digit", minute: "2-digit", hour12: false },
                    )}
                  </time>
                )}
              </button>
            )}
            {notice && (
              <p role="status" className="mt-1 text-xs text-muted-foreground">
                {notice}
              </p>
            )}
            <Dialog open={confirm} onOpenChange={setConfirm}>
              <DialogContent className="max-w-lg">
                <DialogTitle>Delete message</DialogTitle>
                <p className="text-sm">
                  Are you sure you want to delete this message? This cannot be
                  undone.
                </p>
                <div className="rounded border p-3 text-sm">
                  <strong>{userName(user)}</strong>
                  <time className="ml-2 text-xs text-muted-foreground">
                    {new Date(Number(m.ts) * 1000).toLocaleString()}
                  </time>
                  <div className="mt-1 whitespace-pre-wrap">
                    <SlackText
                      text={m.text || ""}
                      users={users}
                      channels={channels}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setConfirm(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={working}
                    onClick={async () => {
                      setWorking(true);
                      try {
                        if (
                          await onAction("delete", {
                            ts: m.ts,
                            thread_ts: m.thread_ts,
                          })
                        )
                          setConfirm(false);
                      } finally {
                        setWorking(false);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            {sharing && (
              <Dialog open={sharing} onOpenChange={setSharing}>
                <DialogContent className="max-w-lg">
                  <DialogTitle>Forward message</DialogTitle>
                  <label
                    className="text-sm font-semibold"
                    htmlFor={`forward-search-${m.ts}`}
                  >
                    Send to
                  </label>
                  {destination ? (
                    <div className="flex items-center gap-2 rounded border p-2">
                      <span className="rounded bg-muted px-2 py-1 text-sm font-semibold">
                        {channels[destination]}
                      </span>
                      <button
                        type="button"
                        className="ml-auto rounded p-1 hover:bg-muted"
                        aria-label="Change forwarding destination"
                        onClick={() => {
                          setDestination("");
                          setDestinationQuery("");
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="rounded border">
                      <input
                        id={`forward-search-${m.ts}`}
                        role="combobox"
                        aria-label="Forward to conversation"
                        aria-autocomplete="list"
                        aria-expanded="true"
                        aria-controls={`forward-options-${m.ts}`}
                        placeholder="Search channels and conversations"
                        className="w-full rounded-t bg-background px-3 py-2 text-sm outline-none"
                        value={destinationQuery}
                        onChange={(e) => setDestinationQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            document
                              .getElementById(`forward-options-${m.ts}`)
                              ?.querySelector<HTMLButtonElement>("button")
                              ?.focus();
                          }
                        }}
                      />
                      <div
                        id={`forward-options-${m.ts}`}
                        role="listbox"
                        aria-label="Forwarding destinations"
                        className="max-h-40 overflow-y-auto border-t py-1"
                      >
                        {Object.entries(channels)
                          .filter(([, name]) =>
                            name
                              .toLowerCase()
                              .includes(destinationQuery.toLowerCase()),
                          )
                          .map(([id, name]) => (
                            <button
                              key={id}
                              type="button"
                              role="option"
                              aria-selected="false"
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted focus:bg-[#1264a3] focus:text-white focus:outline-none"
                              onKeyDown={(e) => {
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  (
                                    e.currentTarget
                                      .nextElementSibling as HTMLElement
                                  )?.focus();
                                }
                                if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  (
                                    e.currentTarget
                                      .previousElementSibling as HTMLElement
                                  )?.focus();
                                }
                              }}
                              onClick={() => setDestination(id)}
                            >
                              {name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                  <textarea
                    aria-label="Add a message to your forward"
                    placeholder="Add a message, if you’d like."
                    className="min-h-20 w-full resize-y rounded border bg-background p-3 text-sm"
                    value={forwardComment}
                    onChange={(e) => setForwardComment(e.target.value)}
                    maxLength={3000}
                  />
                  <div className="rounded border-l-4 border-l-border p-3 text-sm">
                    <div className="mb-1 font-semibold">
                      {userName(users[m.user || ""])}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {new Date(Number(m.ts) * 1000).toLocaleString()}
                      </span>
                    </div>
                    <RichMessage
                      blocks={m.blocks}
                      text={m.text || ""}
                      users={users}
                      channels={channels}
                      emoji={emoji}
                    />
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Shares a link to the original Slack message. Recipients need
                    access to the original conversation.
                  </p>
                  <Button
                    size="sm"
                    disabled={!destination || working}
                    onClick={() => void share()}
                  >
                    Forward
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSharing(false)}
                  >
                    Cancel
                  </Button>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </article>
      </ContextMenuTrigger>
      <ContextMenuContent
        onCloseAutoFocus={(e) => {
          if (openPickerAfterMenu.current) {
            e.preventDefault();
            openPickerAfterMenu.current = false;
            setTimeout(() => setReacting(true), 50);
          }
        }}
        className="w-[300px] rounded-md py-2 text-sm [&_[role=menuitem]]:rounded-none [&_[role=menuitem]]:px-5 [&_[role=menuitem]]:py-1.5 [&_[role=menuitem]]:focus:bg-[#1264a3] [&_[role=menuitem]]:focus:text-white"
      >
        {renderMenuItems(true)}
      </ContextMenuContent>
    </ContextMenu>
  );
}
