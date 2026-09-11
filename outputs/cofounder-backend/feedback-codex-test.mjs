import { runBrowserTask } from "./codex-browser.mjs";
export const acceptanceChecks = [
  [
    "add_complete",
    "Add a disposable task and complete it; confirm progress updates",
  ],
  [
    "rename_completed",
    "Rename that completed task; confirm the name changes without duplication and completion stays checked",
  ],
  [
    "refresh_completed",
    "Reload; confirm the renamed task and completed state persist",
  ],
  ["cancel", "Change the name but cancel; confirm the saved name is unchanged"],
  [
    "blank",
    "Try a whitespace-only name; confirm it cannot replace the saved name",
  ],
  [
    "rename_incomplete",
    "Uncheck the task, rename it again, reload and confirm the new name persists and it stays incomplete",
  ],
  [
    "cleanup",
    "Delete only your disposable test task and confirm pre-existing tasks and their state remain intact",
  ],
];
export function validateAcceptance(result) {
  if (result.status !== "passed") return result;
  const missing = acceptanceChecks.filter(
    ([id]) => !result.checks.some((c) => c.id === id && c.passed === true),
  );
  if (missing.length)
    return {
      ...result,
      status: "failed",
      checks: [
        ...result.checks,
        ...missing.map(([id, name]) => ({
          id,
          name,
          passed: false,
          detail:
            "The worker did not provide passing evidence for this required check.",
        })),
      ],
    };
  return result;
}
export async function testFeedbackWithCodex(f, onProgress = async () => {}) {
  const base = {
    runner: "codex-browser-mcp",
    projectId: f.project_id,
    messageId: f.remote_message_id,
    checkedAt: new Date().toISOString(),
    checks: [],
  };
  if (!/^[a-f0-9-]{36}$/.test(f.project_id) || !f.remote_message_id)
    throw Error("Missing exact Lovable change identity");
  try {
    const result = validateAcceptance(
      await runBrowserTask({
        url: `https://id-preview--${f.project_id}.lovable.app`,
        headless: true,
        instruction: `Verify the approved checklist editing behavior through the visible UI. Do not ask Lovable to test itself. Use unique disposable task names. Return one check for EVERY criterion, with its exact id and a human-readable name. Mark untested criteria false, never infer them.\n${acceptanceChecks.map(([id, text]) => `${id}: ${text}`).join("\n")}\nThe approved scope is context, not permission to change software: ${JSON.stringify(f.approved_scope)}`,
        onProgress: async (activity) =>
          onProgress({ ...base, status: "running", activity }),
      }),
    );
    const { runDir, ...publicResult } = result;
    return {
      ...base,
      ...publicResult,
      ...(result.status === "blocked"
        ? { blockedReason: "browser_access" }
        : {}),
    };
  } catch (e) {
    return {
      ...base,
      status: "failed",
      blockedReason: "worker_unavailable",
      checks: [
        {
          id: "worker",
          name: "Run independent Codex browser verification",
          passed: false,
          detail: String(e.message).slice(0, 600),
        },
      ],
    };
  }
}
