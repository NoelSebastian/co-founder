import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual bridge handler with only its relay dependencies stubbed.
const source = readFileSync(new URL("./e2eBridge.ts", import.meta.url), "utf8");
const start = source.indexOf("async function handleOpenDm(");
const end = source.indexOf("\nasync function handleHideDm(", start);
assert.ok(start >= 0 && end > start);
const compiled = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function handler(channelId = "dm-room") {
  const context = vm.createContext({
    assertExpectedRelayScope() {},
    assertExpectedSigner() {},
    normalizeParticipantPubkeys: (keys) => [...new Set(keys.map(k => k.toLowerCase()))].sort(),
    getMockMemberPubkey: () => "noel",
    findMockDmByParticipantPubkeys: () => undefined,
    getIdentity: () => ({ pubkey: "noel" }),
    submitSignedEvent: async () => ({ message: `response:${JSON.stringify({ channel_id: channelId })}` }),
    relayQuery: async () => [{ created_at: 1700000000, tags: [["name", "DM"]] }],
  });
  return vm.runInContext(`${compiled}\nhandleOpenDm`, context);
}

test("relay DM opening supplies participant metadata before sidebar caching", async () => {
  const dm = await handler()({ pubkeys: ["ALEX", "alex"] }, undefined);
  assert.equal(dm.id, "dm-room");
  assert.equal(dm.channel_type, "dm");
  assert.deepEqual([...dm.participant_pubkeys], ["alex", "noel"]);
  assert.deepEqual([...dm.participants], ["alex", "noel"]);
  assert.deepEqual([...dm.member_pubkeys], ["alex", "noel"]);
  assert.equal(dm.member_count, 2);
  assert.equal(dm.is_member, true);
  assert.equal(dm.last_message_at, null);
});

test("invalid DM open response rejects instead of caching an empty channel", async () => {
  await assert.rejects(handler("")({ pubkeys: ["alex"] }, undefined), /DM channel ID/);
});
