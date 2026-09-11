import type { RichNode } from "./slackRichText";
import { useSlackDraft } from "./useSlackDraft";
import { useSlackOutbox } from "./useSlackOutbox";
import { SlackRequestError } from "./api";
import { groupMessage } from "./messageLayout";
import { SlackComposerPickers } from "./SlackComposerPickers";
import { useEffect, useRef, useState } from "react";
import { X, Send, Paperclip } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { slackApi, type SlackMessage, type SlackUser } from "./api";
import { SlackMessageRow } from "./SlackMessage";
import { SlackEditor } from "./SlackEditor";
export function SlackThread({
  connection,
  channel,
  root,
  users,
  channels,
  emoji,
  onClose,
  onFile,
}: {
  connection: any;
  channel: any;
  root: string;
  users: Record<string, SlackUser>;
  channels: Record<string, string>;
  emoji: Record<string, string>;
  onClose: () => void;
  onFile: (id: string, preview: boolean) => void;
}) {
  const [messages, setMessages] = useState<SlackMessage[]>([]),
    [cursor, setCursor] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const richDraft = useRef<RichNode[]>([]);
  const [showFormatting, setShowFormatting] = useState(true);
  const [outbox, setOutbox] = useSlackOutbox(
    `slack-outbox:${connection.id}:${channel.id}:${root}`,
  );
  const [width, setWidth] = useState(420);
  const [broadcast, setBroadcast] = useState(false);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const locked = useRef(false),
    alive = useRef(true),
    scroll = useRef<HTMLDivElement>(null),
    revision = useRef(""),
    lastFetch = useRef(0);
  const draftKey = `slack-thread-draft:${connection.id}:${channel.id}:${root}`;
  const [text, updateDraft] = useSlackDraft(draftKey);
  const requests = useRef(new Map<string, string>());
  const pages = useRef(1);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !e.defaultPrevented &&
        !document.querySelector(
          '[role="menu"], [data-radix-popper-content-wrapper]',
        ) &&
        !document.querySelector('[data-state="open"][role="dialog"]')
      )
        onClose();
    };
    window.addEventListener("keydown", close, true);
    return () => window.removeEventListener("keydown", close, true);
  }, [onClose]);
  const req = (route: string, body: Record<string, unknown> = {}) =>
    slackApi(route, {
      ...body,
      connection: connection.id,
      channel: channel.id,
    });
  async function refresh(next = "") {
    let r = await req("history", { thread: root, cursor: next });
    let batch: SlackMessage[] = r.messages || [];
    if (!next) {
      for (
        let i = 1;
        i < pages.current && r.response_metadata?.next_cursor;
        i++
      ) {
        r = await req("history", {
          thread: root,
          cursor: r.response_metadata.next_cursor,
        });
        batch.push(...(r.messages || []));
      }
    }
    if (!alive.current) return;
    if (next) pages.current++;
    setMessages((old) =>
      [
        ...new Map(
          [...(next ? old : []), ...batch].map((m) => [m.ts, m]),
        ).values(),
      ].sort((a, b) => Number(a.ts) - Number(b.ts)),
    );
    setCursor(r.response_metadata?.next_cursor || "");
    setLoaded(true);
    lastFetch.current = Date.now();
  }
  useEffect(() => {
    alive.current = true;
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const r = await req("updates");
        if (!alive.current) return;
        if (
          revision.current !== String(r.revision) ||
          Date.now() - lastFetch.current > 60000
        ) {
          revision.current = String(r.revision);
          await refresh();
        }
      } catch (e) {
        if (alive.current) setError(String(e));
      } finally {
        polling = false;
      }
    };
    void poll();
    const timer = setInterval(poll, 3000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [root, channel.id, connection.id]);
  async function action(kind: string, p: Record<string, unknown>) {
    if (kind !== "send" && locked.current) return false;
    if (kind !== "send") {
      locked.current = true;
      setBusy(true);
    }
    let delivered = false;
    setError("");
    const key = JSON.stringify({ kind, p });
    const id = requests.current.get(key) || crypto.randomUUID();
    requests.current.set(key, id);
    if (kind === "send") {
      setOutbox((old) =>
        old.some((m) => m.client_msg_id === id)
          ? old
          : [
              ...old,
              {
                ts: (Date.now() / 1000).toFixed(6),
                client_msg_id: id,
                user: connection.user_id,
                text: String(p.text || ""),
                blocks: richDraft.current,
                localStatus: "pending",
              },
            ],
      );
      updateDraft("");
    }
    try {
      const r = await req("action", {
        id,
        kind,
        payload: {
          channel: channel.id,
          ...p,
          ...(kind === "send" && richDraft.current.length
            ? { blocks: richDraft.current }
            : {}),
        },
      });
      if (r.status === "failed" || r.status === "delivered")
        requests.current.delete(key);
      if (r.status !== "delivered") {
        if (alive.current)
          setOutbox((old) =>
            old.map((m) =>
              m.client_msg_id === id
                ? {
                    ...m,
                    localStatus: r.status === "failed" ? "failed" : "uncertain",
                    localError:
                      r.error || "Not confirmed. Check Slack before retrying.",
                  }
                : m,
            ),
          );
        throw Error(r.error || "Not confirmed. Check Slack before retrying.");
      }
      delivered = true;
      if (!alive.current) return delivered;
      if (kind === "send") {
        const sent = {
          ...r.result.message,
          ts: r.result.ts,
          client_msg_id: id,
        };
        setMessages((old) =>
          [...new Map([...old, sent].map((m) => [m.ts, m])).values()].sort(
            (a, b) => Number(a.ts) - Number(b.ts),
          ),
        );
        setOutbox((old) => old.filter((m) => m.client_msg_id !== id));
      }
      await refresh();
    } catch (e) {
      const rejected = e instanceof SlackRequestError && e.status === 400;
      if (rejected) requests.current.delete(key);
      if (alive.current) {
        setError(String(e));
        setOutbox((old) =>
          old.map((m) =>
            m.client_msg_id === id && m.localStatus === "pending"
              ? {
                  ...m,
                  localStatus: rejected ? "failed" : "uncertain",
                  localError: rejected
                    ? e.message
                    : "Not confirmed. Check Slack before retrying.",
                }
              : m,
          ),
        );
      }
    } finally {
      if (kind !== "send") {
        locked.current = false;
        if (alive.current) setBusy(false);
      }
    }
    return delivered;
  }
  const visibleMessages = [
    ...messages,
    ...outbox.filter(
      (m) =>
        !messages.some((server) => server.client_msg_id === m.client_msg_id),
    ),
  ].sort((a, b) => Number(a.ts) - Number(b.ts));
  return (
    <aside
      role="complementary"
      aria-label="Slack thread"
      style={{ width }}
      className="relative flex h-full min-h-0 max-w-[60%] shrink-0 flex-col border-l bg-background max-md:absolute max-md:inset-0 max-md:z-30 max-md:!w-full max-md:max-w-full"
    >
      <div
        role="separator"
        tabIndex={0}
        aria-label="Resize thread pane"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={320}
        aria-valuemax={720}
        className="absolute -left-1 top-0 z-40 h-full w-2 cursor-col-resize hover:bg-primary/15 max-md:hidden"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, width };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current)
            setWidth(
              Math.min(
                720,
                Math.max(320, drag.current.width + drag.current.x - e.clientX),
              ),
            );
        }}
        onPointerUp={(e) => {
          drag.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            setWidth((w) =>
              Math.min(
                720,
                Math.max(320, w + (e.key === "ArrowLeft" ? 20 : -20)),
              ),
            );
          }
        }}
      />
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-5">
        <h2 className="text-lg font-bold">Thread</h2>
        <button
          aria-label="Close thread"
          className="rounded p-1.5 hover:bg-muted"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </header>
      <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto py-4">
        {visibleMessages.map((m, i) => (
          <div key={m.ts}>
            {i === 1 && (
              <div className="mx-5 my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {Math.max(messages[0]?.reply_count || 0, messages.length - 1)}{" "}
                  {messages.length === 2 ? "reply" : "replies"}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <SlackMessageRow
              connection={connection.id}
              channelId={channel.id}
              compact={i > 1 && groupMessage(visibleMessages[i - 1], m)}
              onRestore={() => {
                updateDraft(m.text || "");
                setOutbox((old) =>
                  old.filter((x) => x.client_msg_id !== m.client_msg_id),
                );
              }}
              onDismiss={() =>
                setOutbox((old) =>
                  old.filter((x) => x.client_msg_id !== m.client_msg_id),
                )
              }
              message={m}
              me={connection.user_id}
              users={users}
              channels={channels}
              emoji={emoji}
              onAction={action}
              showThreadActions={false}
              onThread={() => {}}
              onFile={onFile}
            />
          </div>
        ))}
        {!loaded && (
          <p className="px-5 text-sm text-muted-foreground">Loading thread…</p>
        )}
        {cursor && (
          <Button
            variant="ghost"
            onClick={() =>
              void refresh(cursor).catch((e) => setError(String(e)))
            }
          >
            Load more replies
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {!channel.is_im && !channel.is_mpim && (
        <label className="mx-4 mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={broadcast}
            onChange={(e) => setBroadcast(e.target.checked)}
          />
          Also send to #{channel.name}
        </label>
      )}
      <form
        className="mx-4 mb-4 mt-2 rounded-lg border"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim())
            void action("send", {
              text,
              thread_ts: root,
              reply_broadcast: broadcast,
            });
        }}
      >
        <SlackEditor
          emoji={emoji}
          draftKey={draftKey}
          showFormatting={showFormatting}
          onRichChange={(blocks) => {
            richDraft.current = blocks;
          }}
          users={users}
          value={text}
          onChange={updateDraft}
          disabled={busy || !text.trim()}
          placeholder="Reply…"
          onSend={() => {
            if (text.trim())
              void action("send", {
                text,
                thread_ts: root,
                reply_broadcast: broadcast,
              });
          }}
        />
        <div className="flex items-center gap-2 px-3 pb-2">
          <label
            className="cursor-pointer rounded p-1 hover:bg-muted"
            title="Upload file"
          >
            <Paperclip className="h-4 w-4" />
            <input
              className="sr-only"
              aria-label="Upload thread file"
              type="file"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (f.size > 10 * 1024 * 1024) {
                  setError("Choose a file up to 10 MB.");
                  return;
                }
                const r = new FileReader();
                r.onload = () =>
                  void action("upload", {
                    name: f.name,
                    base64: String(r.result).split(",")[1],
                    thread_ts: root,
                  });
                r.readAsDataURL(f);
              }}
            />
          </label>
          <button
            type="button"
            aria-label="Show formatting"
            aria-pressed={showFormatting}
            title="Show formatting"
            className="rounded p-1.5 text-sm text-muted-foreground underline hover:bg-muted"
            onClick={() => setShowFormatting((v) => !v)}
          >
            Aa
          </button>
          <SlackComposerPickers
            emoji={emoji}
            users={users}
            onInsert={(part) => updateDraft(text + part)}
          />
          <Button
            className="ml-auto"
            size="sm"
            disabled={busy || !text.trim()}
            aria-label="Send thread reply"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </aside>
  );
}
