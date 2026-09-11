import test from "node:test";
import assert from "node:assert/strict";
import { beforeMessage, firstUnread } from "./readCursor.ts";
test("mark unread preserves Slack microseconds and crosses seconds safely", () => {
  assert.equal(beforeMessage("1789117146.744639"), "1789117146.744638");
  assert.equal(beforeMessage("1789117146.000000"), "1789117145.999999");
  assert.equal(beforeMessage("0.000000"), "0.000000");
});
test("unread boundary excludes the cursor itself and tolerates missing read state", () => {
  const messages = [{ ts: "1.000001" }, { ts: "1.000002" }, { ts: "1.000003" }];
  assert.equal(firstUnread(messages, "1.000002"), 2);
  assert.equal(firstUnread(messages, null), -1);
  assert.equal(firstUnread(messages, "1.000003"), -1);
});
