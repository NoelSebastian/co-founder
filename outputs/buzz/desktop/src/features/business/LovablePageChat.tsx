import { useEffect, useRef, useState } from "react";
import { ArrowUp, ExternalLink, LoaderCircle } from "lucide-react";
import { businessApi, pagesChanged, type BusinessPage } from "./businessApi";
import { RichMessage } from "../slack/SlackMessage";
import { SlackAppActions } from "../slack/SlackAppActions";
import { type SlackMessage } from "../slack/api";
import { Button } from "@/shared/ui/button";
export function LovablePageChat({
  page,
  onChange,
}: {
  page: BusinessPage;
  onChange: (p: BusinessPage) => void;
}) {
  const [draft, setDraft] = useState(""),
    [messages, setMessages] = useState<SlackMessage[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [projects, setProjects] = useState<string[]>([]),
    [binding, setBinding] = useState<any>(null);
  const request = useRef<{ id: string; text: string } | null>(null),
    bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const r = await businessApi("lovable", { id: page.id });
        if (active) {
          if (!request.current) setError("");
          setMessages(r.messages);
          setProjects(r.projectIds);
          setBinding(r.binding);
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) timer = setTimeout(refresh, 5000);
      }
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [page.id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);
  async function send() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError("");
    if (!request.current)
      request.current = { id: crypto.randomUUID(), text: draft.trim() };
    try {
      const r = await businessApi("lovable", {
        id: page.id,
        message: request.current.text,
        requestId: request.current.id,
      });
      setMessages(r.messages);
      setProjects(r.projectIds);
      setBinding(r.binding);
      request.current = null;
      setDraft("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const slackLink = binding
    ? `/#/slack?connection=${binding.connection}&channel=${binding.channel}&thread=${binding.ts || ""}`
    : "/#/slack";
  return (
    <aside
      aria-label="Lovable chat"
      className="flex h-full min-h-0 w-full flex-col bg-background"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-5">
        <h2 className="text-sm font-semibold">Lovable</h2>
        <a
          aria-label="Open conversation in Slack"
          href={slackLink}
          className="text-muted-foreground"
        >
          <ExternalLink className="size-4" />
        </a>
      </header>
      <div
        role="log"
        aria-label="Lovable conversation"
        className="min-h-0 flex-1 overflow-y-auto px-5 py-6"
      >
        {!messages.length && (
          <div className="pt-6">
            <h3 className="text-xl font-semibold tracking-tight">
              {page.project_id
                ? "What would you like to change?"
                : "What do you want to build?"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {page.project_id
                ? "Ask Lovable to edit this app or explore its data."
                : "Describe your idea. Lovable will build an app for this page."}
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.ts}
            className={`my-5 break-words text-sm leading-6 ${m.user === binding?.user ? "ml-6 rounded-2xl bg-muted px-4 py-3" : ""}`}
          >
            <RichMessage
              blocks={m.blocks}
              text={m.text || ""}
              users={{}}
              channels={{}}
              emoji={{}}
            />
            <SlackAppActions
              blocks={m.blocks}
              onOpenSlack={() => {
                window.location.href = slackLink;
              }}
            />
          </div>
        ))}
        {projects
          .filter((id) => id !== page.project_id)
          .map((id) => (
            <Button
              key={id}
              variant="outline"
              className="my-2"
              onClick={async () => {
                try {
                  await businessApi("connect", { id: page.id, projectId: id });
                  const r = await businessApi("pages");
                  onChange(r.pages.find((p: BusinessPage) => p.id === page.id));
                  pagesChanged();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Show app in this page
            </Button>
          ))}
        <div ref={bottom} />
      </div>
      <div className="shrink-0 p-4">
        {error && (
          <div role="alert" className="mb-3 text-xs text-destructive">
            {error}{" "}
            <a href="/#/slack" className="underline">
              Slack settings
            </a>
          </div>
        )}
        <form
          className="rounded-2xl border bg-muted/30 p-3 shadow-sm focus-within:border-foreground/30"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            aria-label="Ask Lovable"
            placeholder="Ask Lovable…"
            value={draft}
            disabled={busy || !!request.current}
            maxLength={3000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send();
              }
            }}
            className="min-h-24 w-full resize-none bg-transparent p-1 text-sm outline-none"
          />
          <div className="flex items-center justify-between">
            <span className="rounded-lg border bg-background px-2 py-1 text-xs">
              Build
            </span>
            <button
              type="submit"
              aria-label={
                request.current && !busy
                  ? "Retry Lovable request"
                  : "Send to Lovable"
              }
              disabled={busy || !draft.trim()}
              className="flex size-8 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-30"
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </button>
          </div>
        </form>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Lovable · Your workspace permissions and credits
        </p>
      </div>
    </aside>
  );
}
