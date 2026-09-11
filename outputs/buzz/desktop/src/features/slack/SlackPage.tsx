import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { firstUnread } from "./readCursor";
import { isLovableUser } from "./lovableIntegration";
import type { RichNode } from "./slackRichText";
import { useSlackDraft } from "./useSlackDraft";
import { useSlackOutbox } from "./useSlackOutbox";
import { SlackRequestError } from "./api";
import { groupMessage, messageDay, dayLabel } from "./messageLayout";
import { SlackComposerPickers } from "./SlackComposerPickers";
import { SlackImageViewer } from "./SlackImageViewer";
import { SlackHistory } from "./SlackHistory";
import { SlackThread } from "./SlackThread";
import { SlackEditor } from "./SlackEditor";
import { useEffect, useRef, useState } from "react";
import {
  Hash,
  Search,
  Settings,
  ArrowLeft,
  Paperclip,
  Send,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { SlackSetup } from "./SlackSetup";
import { SlackMessageRow, SlackText } from "./SlackMessage";
import { slackApi, type SlackMessage, type SlackUser, userName } from "./api";
export function SlackPage() {
  const [status, setStatus] = useState<any>(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(""),
    [setup, setSetup] = useState(
      new URLSearchParams(window.location.hash.split("?")[1]).has("setup"),
    );
  async function load() {
    try {
      const s = await slackApi("status");
      setStatus(s);
      setSelected((old) =>
        s.connections.some((c: any) => c.id === old)
          ? old
          : s.connections.find(
              (c: any) =>
                c.id ===
                new URLSearchParams(window.location.hash.split("?")[1]).get(
                  "connection",
                ),
            )?.id ||
            s.connections[0]?.id ||
            "",
      );
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const changed = () => {
      const p = new URLSearchParams(window.location.hash.split("?")[1]);
      setSetup(p.has("setup"));
      if (p.get("connection")) setSelected(p.get("connection")!);
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  if (error)
    return (
      <div className="p-6">
        <p role="alert">{error}</p>
        <Button
          onClick={() => {
            setError("");
            void load();
          }}
        >
          Retry Slack connection
        </Button>
      </div>
    );
  if (!status) return <div className="p-6 text-sm">Loading Slack…</div>;
  const connection = status.connections.find((c: any) => c.id === selected);
  return (
    <div className="flex h-[calc(100dvh-40px)] min-h-0 flex-col overflow-hidden bg-background">
      {(setup || !connection) && (
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-5">
          <Hash className="h-5 w-5" />
          <h1 className="font-semibold">Slack</h1>
          {status.connections.length > 0 && (
            <select
              aria-label="Slack workspace"
              className="max-w-xs rounded bg-transparent p-1 text-sm"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {status.connections.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.team_name}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setSetup(!setup)}
          >
            <Settings className="mr-2 h-4 w-4" />
            {setup ? "Back to messages" : "Connections"}
          </Button>
        </header>
      )}
      {setup || !connection || connection.status !== "connected" ? (
        <div className="min-h-0 flex-1 overflow-auto">
          {connection?.status === "reconnect_required" && (
            <p className="p-4 text-sm text-destructive">
              Slack access expired or was revoked. Connect again to restore
              access.
            </p>
          )}
          <SlackSetup status={status} onChanged={() => void load()} />
          {connection && (
            <div className="px-8 pb-6">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await slackApi("disconnect", { connection: connection.id });
                    await load();
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                Disconnect {connection.team_name}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <SlackWorkspace key={selected} connection={connection} />
      )}
    </div>
  );
}
function SlackWorkspace({ connection: c }: { connection: any }) {
  const [channels, setChannels] = useState<any[]>([]),
    [users, setUsers] = useState<Record<string, SlackUser>>({}),
    [userCursor, setUserCursor] = useState(""),
    [emoji, setEmoji] = useState<Record<string, string>>({});
  const [channel, setChannel] = useState<any>(null),
    [thread, setThread] = useState(""),
    [messages, setMessages] = useState<SlackMessage[]>([]),
    [cursor, setCursor] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [text, setText] = useSlackDraft(`slack-draft:${c.id}:${channel?.id}`);
  const [operations, setOperations] = useState<any[]>([]),
    [sync, setSync] = useState("connecting"),
    [query, setQuery] = useState(""),
    [searchResults, setSearchResults] = useState<any>(null),
    [searchPage, setSearchPage] = useState(1),
    [newDm, setNewDm] = useState(false),
    [peopleQuery, setPeopleQuery] = useState(""),
    [members, setMembers] = useState<string[]>([]),
    [preview, setPreview] = useState("");
  const [previewName, setPreviewName] = useState("Slack attachment");
  const [connectionError, setConnectionError] = useState("");
  const [readCursor, setReadCursor] = useState<string | null>(null);
  const richDraft = useRef<RichNode[]>([]);
  const [showFormatting, setShowFormatting] = useState(true);
  const [outbox, setOutbox] = useSlackOutbox(
    `slack-outbox:${c.id}:${channel?.id}`,
  );
  const readRefreshed = useRef(0);
  const actionBusy = useRef(false);
  const actionRequests = useRef(new Map<string, string>());
  const generation = useRef(0),
    busyRef = useRef(false),
    lastRevision = useRef(""),
    lastRefresh = useRef(0);
  const req = (route: string, body: Record<string, unknown> = {}) =>
    slackApi(route, { ...body, connection: c.id });
  async function run(work: () => Promise<void>, blocking = true) {
    setError("");
    if (blocking) setBusy(true);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (blocking) setBusy(false);
    }
  }
  async function getChannels(next = "") {
    const r = await req("conversations", { cursor: next });
    setChannels((old) =>
      next
        ? [
            ...old,
            ...r.channels.filter((x: any) => !old.some((a) => a.id === x.id)),
          ]
        : r.channels,
    );
    if (r.response_metadata?.next_cursor)
      await getChannels(r.response_metadata.next_cursor);
  }
  async function getUsers(next = "") {
    const r = await req("users", { cursor: next });
    setUsers((old) => ({
      ...old,
      ...Object.fromEntries(r.members.map((u: SlackUser) => [u.id, u])),
    }));
    setUserCursor(r.response_metadata?.next_cursor || "");
  }
  // Newly installed Slack apps may join after the initial directory load.
  // Resolve the selected DM immediately instead of displaying a raw user ID.
  useEffect(() => {
    if (!channel?.is_im || !channel.user || users[channel.user]) return;
    let cancelled = false;
    void req("user", { user: channel.user })
      .then((r) => {
        if (!cancelled && r.user)
          setUsers((old) => ({ ...old, [r.user.id]: r.user }));
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [channel?.id, channel?.user, users]);
  useEffect(() => {
    void run(async () => {
      await Promise.all([
        getChannels(),
        getUsers(),
        req("emoji").then((r) => setEmoji(r.emoji)),
      ]);
    });
  }, []);
  function title(ch: any) {
    return ch?.is_im
      ? userName(users[ch.user]) === "Unknown user"
        ? ch.user
        : userName(users[ch.user])
      : ch?.name || ch?.id || "Conversation";
  }
  async function history(next = "", g = generation.current) {
    if (!channel) return;
    let r;
    try {
      if (!next) {
        const info = await req("info", { channel: channel.id });
        if (g === generation.current) {
          setReadCursor(info.channel?.last_read || null);
          readRefreshed.current = Date.now();
          setChannels((old) =>
            old.map((ch) =>
              ch.id === channel.id ? { ...ch, ...info.channel } : ch,
            ),
          );
        }
      }
      r = await req("history", {
        channel: channel.id,

        cursor: next,
      });
    } catch (e) {
      if (
        g === generation.current &&
        /channel_not_found|not_in_channel|access_denied|Reconnect|token_revoked/.test(
          String(e),
        )
      ) {
        setMessages([]);
        setCursor("");
      }
      throw e;
    }
    if (g !== generation.current) return;
    const fresh: SlackMessage[] = r.messages || [];
    setMessages((old) => {
      const oldest = fresh.length
        ? Math.min(...fresh.map((m) => Number(m.ts)))
        : Infinity;
      const keep = next
        ? old
        : fresh.length
          ? old.filter((m) => Number(m.ts) < oldest)
          : [];
      return [
        ...new Map([...keep, ...fresh].map((m) => [m.ts, m])).values(),
      ].sort((a, b) => Number(a.ts) - Number(b.ts));
    });
    setCursor(r.response_metadata?.next_cursor || "");
    lastRefresh.current = Date.now();
  }
  useEffect(() => {
    const g = ++generation.current;
    setMessages([]);
    setReadCursor(null);
    setCursor("");
    setOperations([]);
    setError("");
    if (channel) void run(() => history("", g));
    return () => {
      generation.current++;
    };
  }, [channel?.id]);
  useEffect(() => {
    let cancelled = false;
    const g = generation.current;
    async function refresh() {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const r = await req("updates", { channel: channel?.id });
        if (cancelled) return;
        setSync(r.sync.status);
        setOperations(r.operations);
        const changed =
          lastRevision.current !== String(r.revision || "") ||
          Date.now() - lastRefresh.current > 60000;
        lastRevision.current = String(r.revision || "");
        if (changed && channel) {
          await history("", g);
        }
        if (channel && Date.now() - readRefreshed.current > 5000) {
          const info = await req("info", { channel: channel.id });
          if (!cancelled && g === generation.current) {
            setReadCursor(info.channel?.last_read || null);
            readRefreshed.current = Date.now();
          }
        }
        if (!cancelled) setConnectionError("");
      } catch (e) {
        if (!cancelled) {
          setSync("reconnecting");
          setConnectionError(String(e));
        }
      } finally {
        busyRef.current = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [channel?.id]);
  async function action(kind: string, p: Record<string, unknown>) {
    if (kind !== "send" && actionBusy.current) return false;
    if (kind !== "send") actionBusy.current = true;
    let delivered = false;
    const g = generation.current;
    try {
      await run(async () => {
        const payload = {
          channel: channel.id,
          ...p,
          ...(kind === "send" && richDraft.current.length
            ? { blocks: richDraft.current }
            : {}),
        };
        const requestKey = JSON.stringify({ kind, payload });
        const id =
          actionRequests.current.get(requestKey) || crypto.randomUUID();
        actionRequests.current.set(requestKey, id);
        if (kind === "send") {
          setOutbox((old) =>
            old.some((m) => m.client_msg_id === id)
              ? old
              : [
                  ...old,
                  {
                    ts: (Date.now() / 1000).toFixed(6),
                    client_msg_id: id,
                    user: c.user_id,
                    text: String(p.text || ""),
                    blocks: richDraft.current,
                    localStatus: "pending",
                  },
                ],
          );
          setText("");
        }
        setOperations((old) => [
          { id, kind, payload, status: "pending" },
          ...old.filter((o) => o.id !== id),
        ]);
        let r;
        try {
          r = await req("action", { id, kind, payload });
        } catch (e) {
          const rejected = e instanceof SlackRequestError && e.status === 400;
          if (rejected) actionRequests.current.delete(requestKey);
          if (kind === "send" && g === generation.current)
            setOutbox((old) =>
              old.map((m) =>
                m.client_msg_id === id
                  ? {
                      ...m,
                      localStatus: rejected ? "failed" : "uncertain",
                      localError: rejected
                        ? String(e.message)
                        : "Not confirmed. Check Slack before retrying.",
                    }
                  : m,
              ),
            );
          setOperations((old) =>
            old.map((o) =>
              o.id === id
                ? {
                    ...o,
                    status: "uncertain",
                    error:
                      "Confirmation unavailable. Check Slack before retrying.",
                  }
                : o,
            ),
          );
          throw e;
        }
        if (g !== generation.current) return;
        setOperations((old) => old.map((o) => (o.id === id ? r : o)));
        if (r.status === "delivered" || r.status === "failed")
          actionRequests.current.delete(requestKey);
        if (r.status !== "delivered") {
          if (kind === "send")
            setOutbox((old) =>
              old.map((m) =>
                m.client_msg_id === id
                  ? {
                      ...m,
                      localStatus:
                        r.status === "failed" ? "failed" : "uncertain",
                      localError: r.error || "Not confirmed",
                    }
                  : m,
              ),
            );
          throw new Error(r.error || "Slack has not confirmed this action.");
        }
        delivered = true;
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
        await history("", g);
      }, kind !== "send");
    } finally {
      if (kind !== "send") actionBusy.current = false;
    }
    return delivered;
  }
  async function file(id: string, show: boolean) {
    await run(async () => {
      if (!show) {
        const r = await req("download-link", { file: id });
        const a = document.createElement("a");
        a.href = "http://127.0.0.1:5180" + r.path;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      const r = await req("download", { file: id });
      const bytes = Uint8Array.from(atob(r.base64), (v: string) =>
        v.charCodeAt(0),
      );
      const safeImage = [
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
      ].includes(r.mime);
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: safeImage ? r.mime : "application/octet-stream",
        }),
      );
      if (show && safeImage) {
        if (preview) URL.revokeObjectURL(preview);
        setPreviewName(r.name);
        setPreview(url);
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = r.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    });
  }
  async function search(page = 1) {
    await run(async () => {
      const r = await req("search", { query, page });
      setSearchResults(r.messages);
      setSearchPage(page);
    });
  }
  useEffect(() => {
    let cancelled = false;
    const select = () => {
      const hash = window.location.hash;
      const p = new URLSearchParams(hash.split("?")[1]);
      const id = p.get("channel");
      const open = (target: any) => {
        if (
          cancelled ||
          window.location.hash !== hash ||
          target.id === channel?.id
        )
          return;
        setChannel(target);
        setThread("");
        setSearchResults(null);
      };
      const target = channels.find((ch) => ch.id === id);
      if (target) open(target);
      else if (id && /^[CGD][A-Z0-9]+$/.test(id)) {
        void req("info", { channel: id })
          .then((r) => {
            if (cancelled || window.location.hash !== hash) return;
            setChannels((old) =>
              old.some((ch) => ch.id === id) ? old : [...old, r.channel],
            );
            open(r.channel);
          })
          .catch((e) => {
            if (!cancelled) setError(String(e));
          });
      }
      if (p.has("new")) {
        setNewDm(true);
        p.delete("new");
        window.history.replaceState(null, "", "#/slack?" + p.toString());
      }
    };
    select();
    window.addEventListener("hashchange", select);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", select);
    };
  }, [channels, channel?.id]);
  const visibleMessages = [
    ...messages,
    ...outbox.filter(
      (m) =>
        !messages.some((server) => server.client_msg_id === m.client_msg_id),
    ),
  ].sort((a, b) => Number(a.ts) - Number(b.ts));
  const names = Object.fromEntries(channels.map((ch) => [ch.id, title(ch)]));
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <form
          className="flex shrink-0 gap-2 border-b px-5 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <Search className="my-auto h-4 w-4 text-muted-foreground" />
          <input
            aria-label="Search Slack messages"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="Search Slack · supports in:channel, from:person, before:date"
          />
          <Button size="sm" variant="ghost" disabled={busy || !query.trim()}>
            Search
          </Button>
        </form>
        {(error || connectionError) && (
          <div
            role="alert"
            className="flex items-center gap-3 border-b px-4 py-2 text-sm text-destructive"
          >
            <span className="flex-1">{error || connectionError}</span>
            <button
              onClick={() => {
                setError("");
                setConnectionError("");
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        {searchResults ? (
          <div className="flex-1 overflow-auto p-4">
            <Button variant="ghost" onClick={() => setSearchResults(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to conversation
            </Button>
            <p className="my-3 text-xs text-muted-foreground">
              {searchResults.total} results available to your Slack account.
              Slack retention and search permissions apply.
            </p>
            {searchResults.matches?.map((m: any) => (
              <button
                className="block w-full border-b p-3 text-left text-sm"
                key={m.ts + m.channel.id}
                onClick={() => {
                  setChannel(
                    channels.find((ch) => ch.id === m.channel.id) || m.channel,
                  );
                  setThread(m.thread_ts || m.ts);
                  setSearchResults(null);
                }}
              >
                <strong>
                  {title(
                    channels.find((ch) => ch.id === m.channel.id) || m.channel,
                  )}
                </strong>
                <span className="ml-2 text-xs text-muted-foreground">
                  {userName(users[m.user])} ·{" "}
                  {new Date(Number(m.ts) * 1000).toLocaleString()}
                </span>
                <div className="mt-1 whitespace-pre-wrap">
                  <SlackText
                    text={m.text || ""}
                    users={users}
                    channels={names}
                  />
                </div>
              </button>
            ))}
            {searchPage > 1 && (
              <Button
                variant="ghost"
                onClick={() => void search(searchPage - 1)}
              >
                Previous
              </Button>
            )}
            {searchPage < searchResults.paging?.pages && (
              <Button
                variant="ghost"
                onClick={() => void search(searchPage + 1)}
              >
                Next results
              </Button>
            )}
          </div>
        ) : channel ? (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b px-5 py-3">
              <span
                title={sync === "connected" ? "Live updates connected" : sync}
                className={
                  "h-1.5 w-1.5 rounded-full " +
                  (sync === "connected" ? "bg-green-600" : "bg-amber-500")
                }
              />
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                {title(channel)}
              </h2>
              {!channel.is_im && !channel.is_mpim && (
                <button
                  className="text-xs text-muted-foreground hover:underline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const lovable = Object.values(users).find(isLovableUser);
                      if (!lovable) {
                        window.location.hash = `/slack?setup=1&connection=${c.id}`;
                        return;
                      }
                      await req("invite", {
                        channel: channel.id,
                        user: lovable.id,
                      });
                      setText(
                        (old) => `${old}${old ? " " : ""}<@${lovable.id}> `,
                      );
                    })
                  }
                >
                  Add Lovable
                </button>
              )}
              <button
                title="Mark conversation read in Slack"
                className="text-xs text-muted-foreground disabled:opacity-40"
                onClick={() => {
                  const ts = messages.at(-1)?.ts;
                  if (ts) void action("mark", { ts });
                }}
              >
                Mark read
              </button>
              <a
                aria-label="Open conversation or Huddle in Slack"
                href={`https://app.slack.com/client/${c.team}/${channel.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <SlackHistory
              key={channel.id}
              firstMessage={visibleMessages[0]?.ts}
            >
              {cursor && (
                <Button
                  variant="ghost"
                  className="m-2"
                  disabled={busy}
                  onClick={() => void run(() => history(cursor))}
                >
                  Load older messages
                </Button>
              )}
              {visibleMessages.map((m, index) => (
                <div key={m.ts}>
                  {(index === 0 ||
                    messageDay(m.ts) !==
                      messageDay(visibleMessages[index - 1].ts)) && (
                    <div className="relative my-4 flex items-center justify-center">
                      <span className="absolute inset-x-0 h-px bg-border" />
                      <span className="relative rounded-full border bg-background px-4 py-1 text-xs font-semibold">
                        {dayLabel(m.ts)}
                      </span>
                    </div>
                  )}
                  {index === firstUnread(visibleMessages, readCursor) && (
                    <div
                      role="separator"
                      aria-label="New messages"
                      className="my-3 flex items-center gap-3 text-xs font-semibold text-[#b82e19]"
                    >
                      <span className="h-px flex-1 bg-[#b82e19]" />
                      <span>New</span>
                      <span className="h-px w-5 bg-[#b82e19]" />
                    </div>
                  )}
                  <SlackMessageRow
                    compact={groupMessage(visibleMessages[index - 1], m)}
                    onRestore={() => {
                      setText(m.text || "");
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
                    connection={c.id}
                    channelId={channel.id}
                    me={c.user_id}
                    users={users}
                    channels={names}
                    emoji={emoji}
                    onAction={action}
                    onThread={setThread}
                    onFile={(id, p) => void file(id, p)}
                  />
                </div>
              ))}
              {!visibleMessages.length && (
                <p className="p-5 text-sm text-muted-foreground">
                  {busy ? "Loading messages…" : "No messages loaded."}
                </p>
              )}
            </SlackHistory>
            <div className="max-h-24 shrink-0 overflow-auto px-5">
              {operations
                .filter(
                  (o) =>
                    o.kind !== "send" &&
                    (o.status === "failed" || o.status === "uncertain"),
                )
                .slice(0, 5)
                .map((o) => (
                  <p key={o.id} className="py-1 text-xs text-muted-foreground">
                    {o.payload.text || o.kind} ·{" "}
                    <strong>
                      {o.status === "delivered" ? "Sent to Slack" : o.status}
                    </strong>
                    {o.error ? " — " + o.error : ""}
                  </p>
                ))}
            </div>
            <form
              className="mx-5 mb-4 mt-2 shrink-0 rounded-lg border border-border bg-background"
              onSubmit={(e) => {
                e.preventDefault();
                void action("send", {
                  text,
                });
              }}
            >
              <SlackEditor
                emoji={emoji}
                draftKey={`slack-draft:${c.id}:${channel?.id}`}
                showFormatting={showFormatting}
                onRichChange={(blocks) => {
                  richDraft.current = blocks;
                }}
                users={users}
                value={text}
                onChange={setText}
                disabled={busy || !text.trim()}
                placeholder={`Message ${title(channel)}`}
                onSend={() => {
                  if (text.trim() && !busy) void action("send", { text });
                }}
              />
              <div className="flex items-center gap-2 px-3 pb-2">
                <label className="cursor-pointer" title="Upload file">
                  <Paperclip className="h-4 w-4" />
                  <input
                    aria-label="Upload Slack file"
                    className="sr-only"
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
                      const reader = new FileReader();
                      reader.onload = () =>
                        void action("upload", {
                          name: f.name,
                          base64: String(reader.result).split(",")[1],
                        });
                      reader.readAsDataURL(f);
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
                  onInsert={(part) => setText((t) => t + part)}
                />
                <span className="ml-auto text-xs text-muted-foreground">
                  Enter to send · Shift Enter for a new line
                </span>
                <Button type="submit" size="sm" disabled={busy || !text.trim()}>
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Send Slack message</span>
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a Slack conversation or start a direct message.
          </div>
        )}
      </div>
      {thread && channel && (
        <SlackThread
          key={channel.id + thread}
          connection={c}
          channel={channel}
          root={thread}
          users={users}
          channels={names}
          emoji={emoji}
          onClose={() => setThread("")}
          onFile={(id, p) => void file(id, p)}
        />
      )}
      <datalist id="slack-emoji">
        {["thumbsup", "heart", "tada", "eyes", ...Object.keys(emoji)].map(
          (name) => (
            <option key={name} value={name} />
          ),
        )}
      </datalist>
      {newDm && (
        <Dialog open onOpenChange={setNewDm}>
          <DialogContent
            aria-label="New Slack direct message"
            className="flex max-h-[80vh] flex-col sm:max-w-[32rem]"
          >
            <DialogHeader>
              <DialogTitle>New message</DialogTitle>
              <DialogDescription>
                Choose one person or up to eight for a group.
              </DialogDescription>
            </DialogHeader>
            <input
              aria-label="Find a Slack person"
              placeholder="To: name"
              className="rounded border bg-background px-3 py-2 text-sm"
              value={peopleQuery}
              onChange={(e) => setPeopleQuery(e.target.value)}
            />
            <div className="min-h-0 flex-1 overflow-auto">
              {Object.values(users)
                .filter(
                  (u) =>
                    !u.deleted &&
                    userName(u)
                      .toLowerCase()
                      .includes(peopleQuery.toLowerCase()),
                )
                .map((u) => (
                  <label key={u.id} className="flex gap-2 p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={members.includes(u.id)}
                      onChange={(e) =>
                        setMembers((old) =>
                          e.target.checked
                            ? [...old, u.id]
                            : old.filter((id) => id !== u.id),
                        )
                      }
                    />
                    {userName(u)}
                  </label>
                ))}
              {userCursor && (
                <Button
                  variant="ghost"
                  onClick={() => void run(() => getUsers(userCursor))}
                >
                  Load more people
                </Button>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                disabled={busy || !members.length || members.length > 8}
                onClick={() =>
                  void run(async () => {
                    const r = await req("open", { users: members });
                    setChannels((old) =>
                      old.some((ch) => ch.id === r.channel.id)
                        ? old
                        : [...old, r.channel],
                    );
                    window.location.hash = `/slack?channel=${r.channel.id}&connection=${c.id}`;
                    window.dispatchEvent(
                      new Event("slack:conversations-changed"),
                    );
                    setChannel(r.channel);
                    setThread("");
                    setNewDm(false);
                    setMembers([]);
                  })
                }
              >
                Start conversation
              </Button>
              <Button variant="ghost" onClick={() => setNewDm(false)}>
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {preview && (
        <SlackImageViewer
          url={preview}
          name={previewName}
          onClose={() => {
            URL.revokeObjectURL(preview);
            setPreview("");
          }}
        />
      )}
    </div>
  );
}
