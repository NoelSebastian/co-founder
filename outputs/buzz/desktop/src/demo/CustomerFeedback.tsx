import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/button";
type Feedback = {
  id: string;
  subject: string;
  body: string;
  status: string;
  recommendation: string | null;
  approved_scope: string | null;
  room: string;
  chat_thread: string | null;
  project_id: string;
  error: string | null;
  reply_body: string | null;
  test_evidence: { checks: { name: string; passed: boolean }[] } | null;
  email_thread_id: string;
};
type Intake = {
  items: Feedback[];
  room: string;
  gmail: {
    configured: boolean;
    connected: boolean;
    callback: string;
    mailbox: string;
    lastChecked: string | null;
    error: string | null;
  };
};
const labels: Record<string, string> = {
  received: "Preparing recommendation",
  needs_approval: "Needs your approval",
  approved: "Approved · queued",
  dispatching: "Starting change",
  building: "Lovable is building",
  testing: "Running independent browser tests",
  manual_tests_required: "Custom acceptance test needed",
  awaiting_tests: "Ready for independent testing",
  tested: "Tests passed · preparing reply",
  drafting_reply: "Creating Gmail draft",
  reply_ready: "Reply draft ready",
  tests_failed: "Tests failed · reply held",
  recommendation_failed: "Recommendation needs attention",
  needs_review: "Needs attention",
  build_failed: "Build failed",
};
const input =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring";
async function api(path: string, body?: unknown) {
  const r = await fetch("http://127.0.0.1:5180" + path, {
    signal: AbortSignal.timeout(30000),
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const j = await r.json();
  if (!r.ok) throw Error(j.error || "Request failed");
  return j;
}
/** Review customer requests, approve exact scope, and observe actual worker state. */
export function CustomerFeedback({ onOpenChat }: { onOpenChat: () => void }) {
  const [data, setData] = useState<Intake | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [scopes, setScopes] = useState<Record<string, string>>({}),
    [plans, setPlans] = useState<Record<string, string>>({}),
    [client, setClient] = useState(""),
    [setup, setSetup] = useState(false);
  useEffect(() => {
    let active = true,
      loading = false;
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
        const d = await api("/feedback");
        if (active) {
          setData(d);
          setError((previous) =>
            previous.startsWith("TypeError: Failed to fetch") ? "" : previous,
          );
        }
      } catch (e) {
        if (active) setError(String(e));
      } finally {
        loading = false;
      }
    };
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);
  async function action(name: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(name);
    setError("");
    try {
      await fn();
      setData(await api("/feedback"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Customer feedback</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer complaint → your approval → app change → testing → reply
            draft.
          </p>
        </div>
        {data?.room && (
          <a
            className="text-sm underline"
            onClick={onOpenChat}
            href={`#/channels/${data.room}`}
          >
            Open channel
          </a>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive p-3 text-sm"
        >
          {error}
        </p>
      )}
      <section
        className="rounded-xl border border-border p-4 space-y-3"
        aria-label="Email monitoring"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-medium">
              {data?.gmail.connected
                ? "Gmail connected"
                : "Gmail monitoring needs connection"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Only email from {data?.gmail.mailbox || "your account"} to itself,
              with a subject starting with “customer”.
            </p>
          </div>
          <Button
            disabled={!data || !!busy}
            onClick={() =>
              void action("connect", async () => {
                if (!data?.gmail.configured) {
                  setSetup(true);
                  return;
                }
                const r = await api("/gmail/connect", {});
                window.open(r.url, "_blank", "noopener,noreferrer");
              })
            }
          >
            {busy === "connect"
              ? "Connecting…"
              : data?.gmail.connected
                ? "Reconnect Gmail"
                : "Connect Gmail"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {data?.gmail.lastChecked
            ? `Last checked ${new Date(data.gmail.lastChecked).toLocaleTimeString()}. Checks every 30 seconds while the local service runs.`
            : "No successful background email check yet."}
        </p>
        {data?.gmail.error && (
          <p role="alert" className="text-sm text-destructive">
            {data.gmail.error}
          </p>
        )}
        {setup && (
          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-sm">
              This application needs its own Google OAuth client before you sign
              in. Enable Gmail API in your Google Cloud project, create a Web
              application OAuth client, and add this redirect address:
            </p>
            <code className="block text-xs break-all">
              {data?.gmail.callback}
            </code>
            <a
              className="inline-block text-sm underline"
              href="https://console.cloud.google.com/auth/clients"
              target="_blank"
              rel="noreferrer"
            >
              Open Google Cloud setup
            </a>
            <label className="block text-sm" htmlFor="gmail-client">
              Google OAuth client JSON
            </label>
            <textarea
              id="gmail-client"
              className={input}
              rows={4}
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Paste the downloaded client JSON here"
            />
            <p className="text-xs text-muted-foreground">
              Stored privately on this computer. Do not paste your Google
              password.
            </p>
            <Button
              disabled={!!busy || !client.trim()}
              onClick={() =>
                void action("configure", async () => {
                  await api("/gmail/configure", JSON.parse(client));
                  setClient("");
                  setSetup(false);
                })
              }
            >
              Save connection setup
            </Button>
          </div>
        )}
      </section>
      {data?.items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <h3 className="font-medium">No customer requests yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Once monitoring is connected, matching emails will appear here and
            in #customer-feedback.
          </p>
        </div>
      )}
      {data?.items.map((f) => (
        <article
          key={f.id}
          className="rounded-xl border border-border p-5 space-y-4"
        >
          <header className="flex justify-between gap-4">
            <h3 className="font-semibold">{f.subject}</h3>
            <span className="rounded-full bg-accent px-3 py-1 text-xs">
              {labels[f.status] || f.status}
            </span>
          </header>
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Customer email
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-sm">{f.body}</p>
          </details>
          {f.recommendation && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {f.recommendation}
            </p>
          )}
          {f.status === "needs_approval" && (
            <div className="space-y-3 border-t border-border pt-4">
              <label
                className="block text-sm font-medium"
                htmlFor={`scope-${f.id}`}
              >
                Change you approve
              </label>
              <textarea
                id={`scope-${f.id}`}
                rows={6}
                className={input}
                value={scopes[f.id] ?? f.recommendation ?? ""}
                onChange={(e) =>
                  setScopes((s) => ({ ...s, [f.id]: e.target.value }))
                }
              />
              <label className="block text-sm" htmlFor={`plan-${f.id}`}>
                Acceptance test
              </label>
              <select
                id={`plan-${f.id}`}
                className={input}
                value={plans[f.id] || "manual"}
                onChange={(e) =>
                  setPlans((p) => ({ ...p, [f.id]: e.target.value }))
                }
              >
                <option value="manual">
                  Custom change · independent test must be added
                </option>
                <option value="checklist-rename">
                  Checklist editing · rename, completion, refresh, cancel, empty
                  name
                </option>
              </select>
              <p className="text-xs text-muted-foreground">
                Approval starts a change in your existing Lovable app. Only this
                scope is sent to the builder.
              </p>
              <Button
                disabled={
                  !!busy || !(scopes[f.id] ?? f.recommendation ?? "").trim()
                }
                onClick={() =>
                  void action(f.id, async () => {
                    await api("/feedback/approve", {
                      id: f.id,
                      scope: scopes[f.id] ?? f.recommendation,
                      testProfile: plans[f.id] || "manual",
                    });
                  })
                }
              >
                {busy === f.id ? "Approving…" : "Approve & build change"}
              </Button>
            </div>
          )}
          {f.error && (
            <p role="alert" className="text-sm text-destructive">
              {f.error}
            </p>
          )}
          {f.status === "recommendation_failed" && (
            <Button
              disabled={!!busy}
              onClick={() =>
                void action(f.id, async () => {
                  await api("/feedback/retry-recommendation", { id: f.id });
                })
              }
            >
              Retry recommendation
            </Button>
          )}
          {f.test_evidence && (
            <ul className="space-y-1 text-sm">
              {f.test_evidence.checks.map((c, i) => (
                <li key={`${i}-${c.name}`}>
                  {c.passed ? "✓" : "✗"} {c.name}
                </li>
              ))}
            </ul>
          )}
          {f.reply_body && (
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                {f.status === "reply_ready"
                  ? "Review unsent Gmail draft"
                  : "Prepared reply · Gmail draft pending"}
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm">{f.reply_body}</p>
            </details>
          )}
          <footer className="flex gap-4 text-sm">
            {f.chat_thread && (
              <a
                className="underline"
                onClick={onOpenChat}
                href={`#/channels/${f.room}?thread=${f.chat_thread}`}
              >
                Discuss in channel
              </a>
            )}
            <a
              className="underline"
              href={`https://lovable.dev/projects/${f.project_id}`}
              target="_blank"
              rel="noreferrer"
            >
              Open app in Lovable
            </a>
            <a
              className="underline"
              href={`https://mail.google.com/mail/u/0/#all/${f.email_thread_id}`}
              target="_blank"
              rel="noreferrer"
            >
              Open email thread
            </a>
          </footer>
        </article>
      ))}
    </div>
  );
}
