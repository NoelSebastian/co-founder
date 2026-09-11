import { customerReply } from "./customer-reply.mjs";
import { testFeedbackWithCodex } from "./feedback-codex-test.mjs";
import { offerChatApproval } from "./feedback-chat.mjs";
import { renameContract } from "./feedback-browser-test.mjs";
import { db, tx } from "./db.mjs";
import { assistant } from "./config.mjs";
import { signed } from "./relay.mjs";
import { call, field, buildStatus } from "./lovable.mjs";
import { recommendFeedback, importFeedback } from "./feedback.mjs";
import {
  requireApprovedChange,
  requirePassedTests,
} from "./feedback-policy.mjs";
import { pollGmail, gmailStatus, createReplyDraft } from "./gmail.mjs";

async function update(f, status, message, fields = {}) {
  await tx(async (c) => {
    await c.query(
      "UPDATE cofounder.feedback SET status=$2,error=$3,updated_at=now() WHERE id=$1",
      [f.id, status, fields.error || null],
    );
    if (f.chat_thread) {
      const event = signed(assistant, 9, message, [
        ["h", f.room],
        ["e", f.chat_thread, "", "reply"],
      ]);
      await c.query(
        "INSERT INTO cofounder.outbox(id,event) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [`feedback:${f.id}:${status}`, event],
      );
    }
  });
}
export async function recoverFeedback() {
  await db.query(
    "UPDATE cofounder.feedback SET status='needs_review',error='The service restarted during an external request. Check Lovable or Gmail before retrying to prevent duplicates.' WHERE status IN ('dispatching','drafting_reply','testing')",
  );
}
let lastPoll = 0;
export async function feedbackTick({
  lovable = call,
  recommend = recommendFeedback,
  poll = pollGmail,
  connection = gmailStatus,
  createDraft = createReplyDraft,
  browserTest = testFeedbackWithCodex,
} = {}) {
  if (Date.now() - lastPoll > 30000) {
    lastPoll = Date.now();
    try {
      await poll(importFeedback);
    } catch {
      /* poller persists its error for the UI; retry at next interval. */
    }
  }
  const {
    rows: [f],
  } = await db.query(
    `SELECT f.* FROM cofounder.feedback f WHERE status IN ('received','approved','building','tested','awaiting_tests')
 AND (status<>'tested' OR $1)
 AND (status<>'approved' OR NOT EXISTS (SELECT 1 FROM cofounder.feedback other WHERE other.id<>f.id AND other.project_id=f.project_id AND other.status IN ('dispatching','building','awaiting_tests','testing','manual_tests_required','test_access_required','tests_failed','needs_review')))
 ORDER BY updated_at LIMIT 1`,
    [connection().connected],
  );
  if (!f) return;
  if (f.status === "received") {
    try {
      const recommended = await recommend(f.id);
      if (recommended?.id)
        await offerChatApproval(
          f.id,
          recommended.recommendation,
          /\b(edit|rename)\b/i.test(f.body) &&
            /\b(checklist|task)\b/i.test(f.body)
            ? "checklist-rename"
            : "manual",
        );
    } catch (e) {
      await update(
        f,
        "recommendation_failed",
        "I could not prepare this recommendation. You can retry from Customer feedback.",
        { error: e.message },
      );
    }
    return;
  }
  if (f.status === "awaiting_tests") {
    if (f.test_plan?.profile !== "checklist-rename") {
      await update(
        f,
        "manual_tests_required",
        "This change needs a custom acceptance test. No customer reply will be drafted until it is verified.",
      );
      return;
    }
    const claim = await db.query(
      "UPDATE cofounder.feedback SET status='testing' WHERE id=$1 AND status='awaiting_tests' RETURNING id",
      [f.id],
    );
    if (!claim.rowCount) return;
    const evidence = await browserTest(f, async (progress) => {
      await db.query(
        "UPDATE cofounder.feedback SET test_evidence=$2,updated_at=now() WHERE id=$1 AND status='testing'",
        [f.id, progress],
      );
    });
    await recordFeedbackTests(f.id, evidence);
    await update(
      f,
      evidence.status === "passed"
        ? "tested"
        : evidence.blockedReason
          ? "test_access_required"
          : "tests_failed",
      evidence.status === "passed"
        ? "Independent browser tests passed: editing, completion, persistence, cancel, and empty names. Preparing an unsent reply."
        : evidence.blockedReason
          ? "Testing needs access to the private Lovable preview. The reply is held until the change can be verified."
          : "An independent browser test failed. The customer reply is held; see the checks in this thread.",
    );
    return;
  }
  if (f.status === "approved") {
    requireApprovedChange(f);
    // Claim before sending: uncertain delivery must never automatically spend twice.
    const claim = await db.query(
      "UPDATE cofounder.feedback SET status='dispatching',started_at=now(),updated_at=now() WHERE id=$1 AND status='approved' RETURNING id",
      [f.id],
    );
    if (!claim.rowCount) return;
    try {
      const r = await lovable("send_message", {
        project_id: f.project_id,
        message: `Implement this human-approved change in this existing project. Inspect the existing implementation first; preserve unrelated behavior.\n\nAPPROVED SCOPE:\n${f.approved_scope}\n\n${f.test_plan?.profile === "checklist-rename" ? renameContract : ""}\n\nDo not publish the app or contact the customer. Summarize changed files and how to exercise the feature. A separate tester will verify the result.`,
        wait: false,
      });
      const messageId = field(r, ["message_id", "messageId"]);
      if (!messageId)
        throw Error(
          "Lovable returned no change identifier. Inspect the project before retrying.",
        );
      await db.query(
        "UPDATE cofounder.feedback SET remote_message_id=$2,remote_thread_id=$3 WHERE id=$1",
        [f.id, messageId, field(r, ["thread_id", "threadId"])],
      );
      await update(
        f,
        "building",
        "Your approved change is now building in the existing Lovable app.",
      );
    } catch (e) {
      await update(
        f,
        "needs_review",
        "Lovable needs attention. I have not retried the change automatically.",
        { error: e.message },
      );
    }
    return;
  }
  if (f.status === "building") {
    if (Date.now() - new Date(f.started_at).getTime() > 1800000) {
      await update(
        f,
        "needs_review",
        "This change has taken over 30 minutes. Check the Lovable editor.",
        { error: "Build timed out; no automatic retry." },
      );
      return;
    }
    try {
      const r = await lovable("get_message", {
        project_id: f.project_id,
        message_id: f.remote_message_id,
        ...(f.remote_thread_id ? { thread_id: f.remote_thread_id } : {}),
      });
      const status = buildStatus(r);
      if (["completed", "done", "success"].includes(status))
        await update(
          f,
          "awaiting_tests",
          `Lovable finished the change. Independent testing is next; the customer reply is held until those checks pass.\n\n[Open preview](https://id-preview--${f.project_id}.lovable.app)`,
        );
      else if (["failed", "error", "cancelled", "canceled"].includes(status))
        await update(
          f,
          "build_failed",
          "Lovable could not complete the change. The customer reply is held.",
          { error: "Lovable reported a failed change." },
        );
      else
        await db.query(
          "UPDATE cofounder.feedback SET updated_at=now() WHERE id=$1",
          [f.id],
        );
    } catch (e) {
      await db.query(
        "UPDATE cofounder.feedback SET error=$2,updated_at=now() WHERE id=$1",
        [f.id, e.message],
      );
    }
    return;
  }
  if (f.status === "tested") {
    requirePassedTests(f);
    if (!connection().connected) return;
    const claim = await db.query(
      "UPDATE cofounder.feedback SET status='drafting_reply' WHERE id=$1 AND status='tested' RETURNING id",
      [f.id],
    );
    if (!claim.rowCount) return;
    try {
      const r = await createDraft(f);
      if (!r.id)
        throw Error(
          "Gmail did not return a draft ID. Inspect Gmail before retrying.",
        );
      await db.query(
        "UPDATE cofounder.feedback SET reply_draft_id=$2 WHERE id=$1",
        [f.id, r.id],
      );
      await update(
        f,
        "reply_ready",
        "The independent checks passed. An unsent reply draft is ready in the original Gmail thread for your review.",
      );
    } catch (e) {
      await update(
        f,
        "needs_review",
        "Creating the reply draft needs attention. No email was sent.",
        { error: e.message },
      );
    }
  }
}
export async function recordFeedbackTests(id, evidence) {
  return tx(async (c) => {
    const {
      rows: [f],
    } = await c.query(
      "SELECT * FROM cofounder.feedback WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (
      !f ||
      ![
        "awaiting_tests",
        "testing",
        "manual_tests_required",
        "test_access_required",
        "tests_failed",
      ].includes(f.status)
    )
      throw Error("This change is not ready for testing");
    if (
      evidence?.projectId !== f.project_id ||
      evidence?.messageId !== f.remote_message_id ||
      !Array.isArray(evidence.checks) ||
      !evidence.checks.length ||
      evidence.checks.some(
        (x) =>
          typeof x.name !== "string" ||
          !x.name.trim() ||
          typeof x.passed !== "boolean",
      )
    )
      throw Error(
        "Test evidence must identify this exact build and named checks",
      );
    const passed =
      evidence.status === "passed" && evidence.checks.every((x) => x.passed);
    if (passed)
      requirePassedTests({ ...f, status: "tested", test_evidence: evidence });
    const body = passed ? customerReply(f) : null;
    await c.query(
      "UPDATE cofounder.feedback SET status=$2,test_evidence=$3,reply_body=$4,updated_at=now() WHERE id=$1",
      [id, passed ? "tested" : "tests_failed", evidence, body],
    );
    return { ok: true, passed };
  });
}
