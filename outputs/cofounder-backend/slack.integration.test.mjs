import { confirmSlackMessage } from "./slack/confirmation.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "./db.mjs";
import { seal, connection } from "./slack/store.mjs";
import { operate } from "./slack/operations.mjs";
test(
  "Slack operation journal prevents duplicates and fences account access",
  { skip: process.env.SLACK_DB_TEST !== "1" },
  async () => {
    const id = randomUUID(),
      actor = "slack-integration-fixture",
      c = { id, actor, team: "TTEST", user_id: "UTEST" };
    await db.query(
      "INSERT INTO cofounder.slack_connections(id,actor,team,user_id,team_name,secret,scopes) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        id,
        actor,
        "TTEST",
        "UTEST",
        "Isolated test fixture",
        seal({ accessToken: "fake-test-credential-0" }),
        "chat:write",
      ],
    );
    try {
      await assert.rejects(
        () => connection("different-user", id),
        (e) => e.status === 404,
      );
      let calls = 0;
      const api = async () => {
        calls++;
        return { ok: true, ts: "1.000001" };
      };
      const op = randomUUID(),
        payload = {
          channel: "CTEST",
          text: "Fixture message — never sent to Slack",
        };
      const result = await Promise.all([
        operate(c, op, "send", payload, api),
        operate(c, op, "send", payload, api),
      ]);
      assert.equal(calls, 1);
      assert.ok(result.every((r) => r.status === "delivered"));
      await assert.rejects(
        () => operate(c, op, "send", { ...payload, text: "changed" }, api),
        (e) => e.status === 409,
      );
      const richId = randomUUID(),
        richPayload = {
          ...payload,
          blocks: [
            {
              type: "rich_text",
              elements: [
                {
                  type: "rich_text_section",
                  elements: [
                    {
                      type: "text",
                      text: payload.text,
                      style: { underline: true, bold: true },
                    },
                  ],
                },
              ],
            },
          ],
        };
      assert.equal(
        (await operate(c, richId, "send", richPayload, api)).status,
        "delivered",
      );
      const stored = (
        await db.query(
          "SELECT payload FROM cofounder.slack_operations WHERE id=$1",
          [richId],
        )
      ).rows[0].payload;
      const beforeRetry = calls;
      assert.equal(
        (await operate(c, richId, "send", stored, api)).status,
        "delivered",
      );
      assert.equal(calls, beforeRetry);
      await assert.rejects(
        () => operate(c, richId, "send", { ...richPayload, blocks: [] }, api),
        (e) => e.status === 409,
      );
      let attempts = 0;
      const unknown = async () => {
        attempts++;
        throw Object.assign(Error("Network interrupted"), { uncertain: true });
      };
      const uncertainId = randomUUID();
      assert.equal(
        (await operate(c, uncertainId, "send", payload, unknown)).status,
        "uncertain",
      );
      await operate(c, uncertainId, "send", payload, unknown);
      assert.equal(attempts, 1);
      const event = {
        type: "message",
        client_msg_id: uncertainId,
        channel: "CTEST",
        user: "UTEST",
        ts: "1.000003",
        text: payload.text,
      };
      await confirmSlackMessage("TWRONG", event);
      assert.equal(
        (await operate(c, uncertainId, "send", payload, unknown)).status,
        "uncertain",
      );
      await confirmSlackMessage("TTEST", { ...event, user: "UOTHER" });
      assert.equal(
        (await operate(c, uncertainId, "send", payload, unknown)).status,
        "uncertain",
      );
      await confirmSlackMessage("TTEST", event);
      assert.equal(
        (await operate(c, uncertainId, "send", payload, unknown)).status,
        "delivered",
      );
      assert.equal(attempts, 1);
      const raceId = randomUUID();
      const acceptedThenLost = async () => {
        await confirmSlackMessage("TTEST", { ...event, client_msg_id: raceId });
        throw Object.assign(
          Error("HTTP response lost after event confirmation"),
          { uncertain: true },
        );
      };
      assert.equal(
        (await operate(c, raceId, "send", payload, acceptedThenLost)).status,
        "delivered",
      );
      let broadcastArgs;
      const broadcastApi = async (_c, method, args) => {
        assert.equal(method, "chat.postMessage");
        broadcastArgs = args;
        return { ok: true, ts: "1.000002" };
      };
      assert.equal(
        (
          await operate(
            c,
            randomUUID(),
            "send",
            { ...payload, thread_ts: "1.000001", reply_broadcast: true },
            broadcastApi,
          )
        ).status,
        "delivered",
      );
      assert.equal(broadcastArgs.reply_broadcast, true);
      assert.equal(broadcastArgs.thread_ts, "1.000001");
      let edits = 0;
      const otherUser = async (_c, method) => {
        if (method === "conversations.history")
          return { messages: [{ ts: "1.000001", user: "UOTHER" }] };
        edits++;
      };
      assert.equal(
        (
          await operate(
            c,
            randomUUID(),
            "delete",
            { channel: "CTEST", ts: "1.000001" },
            otherUser,
          )
        ).status,
        "failed",
      );
      assert.equal(edits, 0);
    } finally {
      await db.query("DELETE FROM cofounder.slack_connections WHERE id=$1", [
        id,
      ]);
      await db.end();
    }
  },
);
