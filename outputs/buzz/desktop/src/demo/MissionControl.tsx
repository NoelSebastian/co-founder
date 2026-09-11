import { CustomerFeedback } from "./CustomerFeedback";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  FileText,
  Loader2,
  Plus,
  Rocket,
  Target,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";

type Brief = {
  id: string;
  title: string;
  content: string;
  thread: string;
  version: number;
  status: string;
};
type Job = {
  id: string;
  title: string;
  version: number;
  status: string;
  preview_url: string | null;
  editor_url: string | null;
  error: string | null;
};
type Priority = { id: string; title: string; owner: string; done: boolean };
type Workspace = {
  room: string;
  user: string;
  briefs: Brief[];
  jobs: Job[];
  priorities: Priority[];
};
type Conversation = { id: string; content: string; author: string };
const api = async (path: string, body?: unknown) => {
  const r = await fetch(
    `http://127.0.0.1:5180${path}`,
    body === undefined
      ? { signal: AbortSignal.timeout(15000) }
      : {
          signal: AbortSignal.timeout(120000),
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Something went wrong.");
  return data;
};
const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const labels: Record<string, string> = {
  queued: "Queued",
  dispatching: "Starting Lovable",
  running: "Building",
  completed: "Ready to try",
  failed: "Build failed",
  needs_review: "Needs attention",
};
/** Local MVP workflow surface; all shared records are stored on the backend. */
export function MissionControl() {
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState("overview"),
    [data, setData] = useState<Workspace | null>(null),
    [conversations, setConversations] = useState<Conversation[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Brief | null>(null),
    [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [thread, setThread] = useState(""),
    [priority, setPriority] = useState(""),
    [owner, setOwner] = useState("Noel");
  async function refresh() {
    const d = await api("/workspace");
    setData(d);
    return d;
  }
  useEffect(() => {
    const listener = () => setOpen(true);
    window.addEventListener("cofounder:mission-control", listener);
    return () =>
      window.removeEventListener("cofounder:mission-control", listener);
  }, []);
  useEffect(() => {
    if (!open) return;
    let active = true;
    let loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const [d, c] = await Promise.all([
          api("/workspace"),
          api("/conversations"),
        ]);
        if (active) {
          setData(d);
          setError((previous) =>
            previous.startsWith("TypeError: Failed to fetch") ? "" : previous,
          );
          setConversations(c);
        }
      } catch (e) {
        if (active) setError(String(e));
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = setInterval(() => {
      void load();
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [open]);
  function select(b: Brief | null) {
    setSelected(b);
    setTitle(b?.title || "");
    setContent(b?.content || "");
    setThread(b?.thread || conversations[0]?.id || "");
    setError("");
    setNotice("");
    setTab("briefs");
  }
  async function action(name: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(name);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }
  const dirty =
    !!selected && (selected.title !== title || selected.content !== content);
  const current = data?.briefs.find((b) => b.id === selected?.id);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="flex h-[90vh] w-[min(1100px,95vw)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        showCloseButton={false}
      >
        <header className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Target size={14} /> CO-FOUNDER
            </div>
            <DialogTitle className="text-xl">Mission Control</DialogTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              From a conversation to something your team can try.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close Mission Control"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </Button>
        </header>
        <nav
          className="flex flex-wrap gap-2 border-b border-border px-6 py-3"
          aria-label="Mission Control sections"
        >
          {[
            ["overview", "Priorities"],
            ["feedback", "Customer feedback"],
            ["briefs", "Shared PRDs"],
            ["builds", "Builds"],
            ["teams", "Teams & connections"],
          ].map(([id, label]) => (
            <Button
              key={id}
              variant={tab === id ? "secondary" : "ghost"}
              onClick={() => setTab(id)}
            >
              {label}
              {id === "builds" && !!data?.jobs.length && (
                <span className="ml-1 text-xs">{data.jobs.length}</span>
              )}
            </Button>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
            >
              {error}{" "}
              <button
                type="button"
                className="underline"
                onClick={() =>
                  void action("reload", async () => {
                    await refresh();
                  })
                }
              >
                Reload
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className="mb-4 rounded-lg bg-accent p-3 text-sm">
              {notice}
            </p>
          )}
          {!data && !error && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="animate-spin" size={16} /> Connecting to your
              workspace…
            </p>
          )}
          {tab === "feedback" && (
            <CustomerFeedback onOpenChat={() => setOpen(false)} />
          )}
          {data && tab === "overview" && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [
                    "Founder priorities",
                    `${data.priorities.filter((p) => !p.done).length} open`,
                  ],
                  ["Shared PRDs", `${data.briefs.length} documents`],
                  [
                    "Working previews",
                    `${data.jobs.filter((j) => j.status === "completed").length} ready`,
                  ],
                ].map(([a, b]) => (
                  <div key={a} className="rounded-xl border border-border p-5">
                    <p className="text-sm text-muted-foreground">{a}</p>
                    <p className="mt-2 text-2xl font-semibold">{b}</p>
                  </div>
                ))}
              </div>
              <section className="rounded-xl border border-border p-5">
                <h2 className="font-semibold">What matters this week</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Shared with Noel and Alex. Keep the next decision clear.
                </p>
                <form
                  className="mt-4 flex flex-wrap gap-2 sm:flex-nowrap"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action("priority", async () => {
                      await api("/priority", { title: priority, owner });
                      setPriority("");
                    });
                  }}
                >
                  <input
                    aria-label="New founder priority"
                    placeholder="Add a founder priority…"
                    className={field}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    maxLength={300}
                  />
                  <select
                    aria-label="Priority owner"
                    className={field + " max-w-28"}
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                  >
                    <option>Noel</option>
                    <option>Alex</option>
                  </select>
                  <Button type="submit" disabled={!!busy || !priority.trim()}>
                    <Plus size={16} /> Add
                  </Button>
                </form>
                <div className="mt-4 divide-y divide-border">
                  {data.priorities.map((p) => (
                    <label key={p.id} className="flex items-center gap-3 py-3">
                      <input
                        type="checkbox"
                        checked={p.done}
                        disabled={!!busy}
                        onChange={() =>
                          void action("priority", async () => {
                            await api("/priority", { ...p, done: !p.done });
                          })
                        }
                      />
                      <span
                        className={
                          "flex-1 text-sm " +
                          (p.done ? "text-muted-foreground line-through" : "")
                        }
                      >
                        {p.title}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-1 text-xs">
                        {p.owner}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
              <section className="flex items-center justify-between rounded-xl bg-accent p-5">
                <div>
                  <h2 className="font-semibold">
                    Ready to turn a discussion into a prototype?
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Draft a PRD, agree on the scope, then let Lovable build.
                  </p>
                </div>
                <Button onClick={() => select(null)}>
                  Create a PRD <ArrowUpRight size={16} />
                </Button>
              </section>
            </div>
          )}
          {data && tab === "briefs" && (
            <div className="grid gap-6 md:grid-cols-[230px_1fr]">
              <aside className="space-y-2">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => select(null)}
                >
                  <Plus size={15} /> New PRD
                </Button>
                {data.briefs.map((b) => (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => select(b)}
                    className={`w-full rounded-lg border p-3 text-left ${selected?.id === b.id ? "border-primary bg-accent" : "border-border"}`}
                  >
                    <p className="text-sm font-medium">{b.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Version {b.version} · {b.status}
                    </p>
                  </button>
                ))}
              </aside>
              <section className="space-y-4">
                <div>
                  <h2 className="font-semibold">
                    {selected
                      ? "Review your shared PRD"
                      : "Start from a conversation"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Only the version you approve is sent to Lovable. Editing
                    creates a new draft.
                  </p>
                </div>
                {!selected && (
                  <label className="block text-sm">
                    Conversation
                    <select
                      aria-label="Source conversation"
                      className={field + " mt-2"}
                      value={thread}
                      onChange={(e) => setThread(e.target.value)}
                    >
                      <option value="">Choose a conversation…</option>
                      {conversations.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.author}:{" "}
                          {c.content
                            .replace(/nostr:npub\w+/g, "@agent")
                            .slice(0, 100)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block text-sm">
                  Title
                  <input
                    aria-label="PRD title"
                    className={field + " mt-2"}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={160}
                    placeholder="e.g. Lantern onboarding checklist"
                  />
                </label>
                {!selected && (
                  <Button
                    variant="secondary"
                    disabled={!!busy || !thread || !title.trim()}
                    onClick={() =>
                      void action("draft", async () => {
                        const b = await api("/draft", { thread, title });
                        select(b);
                        setNotice(
                          "Draft saved. Review the requirements before approving.",
                        );
                      })
                    }
                  >
                    {busy === "draft" ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <FileText size={16} />
                    )}{" "}
                    {busy === "draft"
                      ? "Drafting from the conversation…"
                      : "Ask Co-founder to draft"}
                  </Button>
                )}
                <label className="block text-sm">
                  Requirements
                  <textarea
                    aria-label="PRD requirements"
                    className={
                      field + " mt-2 min-h-72 font-mono leading-relaxed"
                    }
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    maxLength={30000}
                    placeholder="Draft with Co-founder, or write your requirements here."
                  />
                </label>
                {current &&
                  selected &&
                  current.version !== selected.version && (
                    <p role="alert" className="text-sm text-destructive">
                      A newer version is available. Select this PRD again to
                      review it.
                    </p>
                  )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    disabled={
                      !!busy || !title.trim() || !content.trim() || !thread
                    }
                    onClick={() =>
                      void action("save", async () => {
                        select(
                          await api("/brief", {
                            id: selected?.id,
                            version: selected?.version,
                            title,
                            content,
                            thread,
                          }),
                        );
                        setNotice("New draft version saved for both users.");
                      })
                    }
                  >
                    Save draft
                  </Button>
                  <Button
                    disabled={
                      !!busy ||
                      !selected ||
                      dirty ||
                      current?.version !== selected?.version ||
                      current?.status === "approved"
                    }
                    onClick={() =>
                      void action("approve", async () => {
                        await api("/approve", {
                          id: selected?.id,
                          version: selected?.version,
                        });
                        setNotice(
                          "Approved. This version is ready for Lovable.",
                        );
                      })
                    }
                  >
                    <Check size={16} />{" "}
                    {current?.status === "approved" && !dirty
                      ? "Approved"
                      : "Approve version"}
                  </Button>
                  <Button
                    disabled={!!busy || dirty || current?.status !== "approved"}
                    onClick={() =>
                      void action("build", async () => {
                        await api("/build", {
                          id: current?.id,
                          version: current?.version,
                        });
                        setTab("builds");
                      })
                    }
                  >
                    <Rocket size={16} /> Build with Lovable
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Builds use Noel’s connected Lovable workspace and its credits.
                  The approved PRD is sent to Lovable. Previews may require
                  Lovable sign-in.
                </p>
              </section>
            </div>
          )}
          {data && tab === "builds" && (
            <div className="space-y-4">
              <h2 className="font-semibold">
                From approved scope to working preview
              </h2>
              <p className="text-sm text-muted-foreground">
                Builds continue on the backend while your browser is closed.
                Repeated build requests for the same version reuse its existing
                job.
              </p>
              {!data.jobs.length && (
                <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
                  Approve a PRD to start your first build.
                </div>
              )}
              {data.jobs.map((j) => (
                <article
                  key={j.id}
                  className="rounded-xl border border-border p-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{j.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Approved version {j.version}
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-1 text-sm">
                      {labels[j.status] || j.status}
                    </span>
                  </div>
                  {j.error && (
                    <p role="alert" className="mt-3 text-sm text-destructive">
                      {j.error}
                    </p>
                  )}
                  <div className="mt-4 flex gap-4">
                    {j.status === "completed" && j.preview_url && (
                      <a
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary underline"
                        href={j.preview_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open preview <ArrowUpRight size={15} />
                      </a>
                    )}
                    {j.editor_url && (
                      <a
                        className="text-sm text-muted-foreground underline"
                        href={j.editor_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open in Lovable
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          {tab === "teams" && (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold">A place for each function</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Department connections are planned for the next version. No
                  external accounts are connected here yet.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  [
                    "Sales",
                    "Pipeline research and customer discovery",
                    "CRM · customer calls",
                  ],
                  [
                    "Marketing",
                    "Positioning, campaigns, and launch plans",
                    "Analytics · content tools",
                  ],
                  [
                    "HR",
                    "Hiring plans and team onboarding",
                    "Hiring · people systems",
                  ],
                ].map(([a, b, c]) => (
                  <article
                    key={a}
                    className="rounded-xl border border-border p-5"
                  >
                    <h3 className="font-semibold">{a}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{b}</p>
                    <p className="mt-5 text-xs">{c}</p>
                    <span className="mt-3 inline-block rounded-full bg-secondary px-2 py-1 text-xs">
                      Planned
                    </span>
                  </article>
                ))}
              </div>
              <div className="rounded-xl border border-border p-5">
                <h3 className="font-medium">Available in this MVP</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Co-founder uses OpenRouter for shared chat and PRDs. Lovable
                  builds approved PRDs through Noel’s connection. Human chat and
                  saved messages use the original Buzz backend.
                </p>
              </div>
            </div>
          )}
        </div>
        <footer className="flex items-center justify-between border-t border-border px-6 py-3 text-xs text-muted-foreground">
          <span>Local MVP · Shared with Noel and Alex</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Back to chat
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
