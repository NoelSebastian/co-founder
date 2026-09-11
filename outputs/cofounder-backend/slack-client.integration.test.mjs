import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebClient } from "@slack/web-api";
import { db } from "./db.mjs";
import { seal } from "./slack/store.mjs";
import { call } from "./slack/client.mjs";
test(
  "official SDK honors rate cooldown and does not retry an uncertain write",
  { skip: process.env.SLACK_DB_TEST !== "1" },
  async () => {
    const id = randomUUID(),
      c = {
        id,
        actor: "rate-fixture",
        team: "T" + randomUUID(),
        user_id: "UTEST",
      };
    let mode = "limit",
      requests = 0;
    const server = http.createServer((req, res) => {
      requests++;
      if (mode === "drop") {
        req.socket.destroy();
        return;
      }
      res.setHeader("Content-Type", "application/json");
      if (mode === "limit") {
        res.writeHead(429, { "Retry-After": "1" });
        res.end('{"ok":false,"error":"ratelimited"}');
      } else res.end('{"ok":true,"messages":[]}');
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const factory = (token, options) =>
      new WebClient(token, {
        ...options,
        slackApiUrl: `http://127.0.0.1:${server.address().port}/`,
      });
    try {
      await db.query(
        "INSERT INTO cofounder.slack_connections(id,actor,team,user_id,team_name,secret,scopes) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          c.actor,
          c.team,
          c.user_id,
          "Isolated rate test",
          seal({ accessToken: "fake-test-credential-0" }),
          "chat:write",
        ],
      );
      await assert.rejects(
        () => call(c, "conversations.history", { channel: "CTEST" }, factory),
        (e) => e.status === 429,
      );
      const count = requests;
      await assert.rejects(
        () => call(c, "conversations.history", { channel: "CTEST" }, factory),
        (e) => e.status === 429,
      );
      assert.equal(requests, count, "cooldown must prevent network call");
      await db.query(
        "UPDATE cofounder.slack_limits SET until_at=now()-interval '1 second' WHERE team=$1",
        [c.team],
      );
      mode = "ok";
      assert.equal(
        (await call(c, "conversations.history", { channel: "CTEST" }, factory))
          .ok,
        true,
      );
      mode = "drop";
      const before = requests;
      await assert.rejects(
        () =>
          call(
            c,
            "chat.postMessage",
            { channel: "CTEST", text: "Local fake server only" },
            factory,
          ),
        (e) => e.uncertain === true,
      );
      assert.equal(
        requests,
        before + 1,
        "uncertain write must never auto retry",
      );
    } finally {
      await db.query("DELETE FROM cofounder.slack_limits WHERE team=$1", [
        c.team,
      ]);
      await db.query("DELETE FROM cofounder.slack_connections WHERE id=$1", [
        id,
      ]);
      await new Promise((resolve) => server.close(resolve));
      await db.end();
    }
  },
);
