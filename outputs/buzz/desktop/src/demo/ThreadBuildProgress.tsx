import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle, Clock3 } from "lucide-react";
type Work = {
  id: string;
  room: string;
  chat_thread: string;
  status: string;
  project_id: string;
  started_at: string | null;
  updated_at: string;
  error: string | null;
  approved_scope: string | null;
  reply_body: string | null;
  test_evidence: {
    runner?: string;
    activity?: { tool: string; status: string };
    checks: { name: string; passed: boolean; detail?: string }[];
  } | null;
};
const browserActions: Record<string, string> = {
  browser_navigate: "Opening the app",
  browser_snapshot: "Inspecting the page",
  browser_click: "Trying a control",
  browser_type: "Entering test data",
  browser_fill_form: "Completing a form",
  browser_take_screenshot: "Capturing evidence",
  browser_press_key: "Using the keyboard",
  browser_wait_for: "Waiting for the app",
};
const phases = ["Starting", "Building", "Testing", "Reply draft"];
const stage: Record<string, number> = {
  approved: 0,
  dispatching: 0,
  building: 1,
  awaiting_tests: 2,
  testing: 2,
  tests_failed: 2,
  test_access_required: 2,
  manual_tests_required: 2,
  tested: 3,
  drafting_reply: 3,
  reply_ready: 4,
};
const titles: Record<string, string> = {
  needs_approval: "Waiting for your yes",
  approved: "Your change is queued",
  dispatching: "Sending your change to Lovable",
  building: "Lovable is building your change",
  awaiting_tests: "Build finished · tests are next",
  testing: "Running independent browser tests",
  tests_failed: "A test failed · reply held",
  test_access_required: "Testing needs preview access",
  manual_tests_required: "A custom acceptance test is needed",
  tested: "Tests passed · preparing the reply",
  drafting_reply: "Saving your Gmail reply draft",
  reply_ready: "Change tested · reply ready",
  needs_review: "This change needs attention",
  build_failed: "Lovable could not finish the change",
  received: "Preparing a recommendation",
  recommendation_failed: "Recommendation needs attention",
};
/** Live local workflow status, scoped to the actual open Buzz thread. */
export function ThreadBuildProgress({
  threadId,
  room,
}: {
  threadId: string;
  room: string | null;
}) {
  const [work, setWork] = useState<Work | null>(null),
    [offline, setOffline] = useState(false),
    [now, setNow] = useState(Date.now()),
    [preview, setPreview] = useState(false),
    [attempt, setAttempt] = useState(0),
    [retryError, setRetryError] = useState<string | null>(null),
    [retrying, setRetrying] = useState(false);
  useEffect(() => {
    let active = true,
      busy = false;
    setWork(null);
    setPreview(false);
    setOffline(false);
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const r = await fetch("http://127.0.0.1:5180/feedback", {
          signal: AbortSignal.timeout(12000),
        });
        if (!r.ok) throw Error("Status unavailable");
        const data = await r.json();
        if (active) {
          setWork(
            data.items.find(
              (x: Work) => x.chat_thread === threadId && x.room === room,
            ) || null,
          );
          setOffline(false);
        }
      } catch {
        if (active) setOffline(true);
      } finally {
        busy = false;
      }
    };
    void load();
    const timer = setInterval(() => {
      setNow(Date.now());
      void load();
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [threadId, room, attempt]);
  if (!work) return null;
  const index = stage[work.status] ?? -1,
    failed = [
      "needs_review",
      "build_failed",
      "tests_failed",
      "manual_tests_required",
      "test_access_required",
      "recommendation_failed",
    ].includes(work.status),
    active = index >= 0 && index < 4 && !failed;
  const elapsed = work.started_at
    ? Math.max(
        0,
        Math.floor((now - new Date(work.started_at).getTime()) / 60000),
      )
    : null;
  const url = `https://id-preview--${work.project_id}.lovable.app`;
  return (
    <section
      aria-label="Change progress"
      className="shrink-0 border-b border-border bg-muted/30 px-4 py-3"
      data-testid="thread-build-progress"
    >
      <div className="flex items-start gap-2">
        {offline || failed ? (
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
        ) : work.status === "reply_ready" ? (
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
        ) : active ? (
          <Loader2
            size={16}
            className="mt-0.5 shrink-0 animate-spin text-primary"
          />
        ) : (
          <Clock3 size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p role="status" className="text-sm font-semibold">
            {offline
              ? "Live status disconnected"
              : titles[work.status] || "Checking your change"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {offline
              ? "Last known state is shown. Reconnecting automatically."
              : work.status === "building"
                ? `${elapsed !== null ? `${elapsed < 1 ? "Less than a minute" : `${elapsed} min`} elapsed · ` : ""}Lovable status checked ${new Date(work.updated_at).toLocaleTimeString()}`
                : work.status === "needs_approval"
                  ? "Reply yes in this thread to start."
                  : work.status === "reply_ready"
                    ? "Nothing has been emailed. Review the draft below."
                    : "Progress stays here in this conversation."}
          </p>
        </div>
      </div>
      {index >= 0 && (
        <ol aria-label="Change stages" className="mt-3 grid grid-cols-4 gap-1">
          {phases.map((label, i) => (
            <li
              key={label}
              aria-current={i === index ? "step" : undefined}
              className={`border-t-2 pt-1 text-xs ${i < index ? "border-green-600 text-foreground" : i === index ? "border-primary font-medium text-foreground" : "border-border text-muted-foreground"}`}
            >
              {i < index ? "✓ " : ""}
              {label}
            </li>
          ))}
        </ol>
      )}
      <div className="max-h-72 overflow-y-auto">
        {work.error && (
          <p className="mt-2 text-xs text-destructive">{work.error}</p>
        )}
        {["test_access_required", "tests_failed"].includes(work.status) && (
          <div className="mt-2">
            <button
              type="button"
              className="text-xs underline"
              disabled={retrying}
              onClick={async () => {
                setRetrying(true);
                setRetryError(null);
                try {
                  const response = await fetch(
                    "http://127.0.0.1:5180/feedback/retry-tests",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: work.id }),
                    },
                  );
                  if (!response.ok)
                    throw Error(
                      (await response.json()).error || "Could not retry tests",
                    );
                  setAttempt((x) => x + 1);
                } catch (error) {
                  setRetryError(
                    error instanceof Error
                      ? error.message
                      : "Could not retry tests",
                  );
                } finally {
                  setRetrying(false);
                }
              }}
            >
              {retrying ? "Queuing tests…" : "Retry browser tests"}
            </button>
            {retryError && (
              <p className="mt-1 text-xs text-destructive">{retryError}</p>
            )}
          </div>
        )}
        {offline && (
          <button
            className="mt-2 text-xs underline"
            type="button"
            onClick={() => setAttempt((x) => x + 1)}
          >
            Reconnect status
          </button>
        )}
        {work.status === "testing" && work.test_evidence?.activity && (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            Codex ·{" "}
            {browserActions[work.test_evidence.activity.tool] ||
              "Checking the workflow"}
            {work.test_evidence.activity.status === "completed"
              ? " · done"
              : work.test_evidence.activity.status === "failed"
                ? " · needs attention"
                : "…"}
          </p>
        )}
        {work.test_evidence && (
          <details className="mt-3" open={failed || work.status === "testing"}>
            <summary className="cursor-pointer text-xs font-medium">
              Test results ·{" "}
              {work.test_evidence.checks.filter((c) => c.passed).length}/
              {work.test_evidence.checks.length} passed
            </summary>
            <ul className="mt-2 space-y-1 text-xs">
              {work.test_evidence.checks.map((c, i) => (
                <li key={`${i}-${c.name}`}>
                  {c.passed ? "✓" : "✗"} {c.name}
                  {!c.passed && c.detail && (
                    <details>
                      <summary className="cursor-pointer text-muted-foreground">
                        Failure details
                      </summary>
                      <p className="whitespace-pre-wrap break-words">
                        {c.detail}
                      </p>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
        {work.approved_scope && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              What you approved
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-xs">
              {work.approved_scope}
            </p>
          </details>
        )}
        {index >= 2 && (
          <div className="mt-3">
            <button
              type="button"
              className="text-xs font-medium underline"
              onClick={() => setPreview((x) => !x)}
            >
              {preview ? "Hide app preview" : "Preview the app here"}
            </button>
            {work.status !== "reply_ready" && (
              <span className="ml-2 text-xs text-muted-foreground">
                {failed ? "Checks need attention" : "Verification in progress"}
              </span>
            )}
          </div>
        )}
        {preview && (
          <p className="mt-2 text-xs text-muted-foreground">
            Private Lovable previews may require sign-in.{" "}
            <a
              className="underline"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Open the full preview
            </a>
          </p>
        )}
        {preview && (
          <iframe
            title="Updated app preview"
            src={url}
            className="mt-2 h-64 w-full rounded-md border border-border bg-background"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        )}
        {work.reply_body && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium">
              Review the unsent reply
            </summary>
            <p className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm">
              {work.reply_body}
            </p>
          </details>
        )}
      </div>
    </section>
  );
}
