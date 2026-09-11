import assert from "node:assert/strict";
import test from "node:test";
import {
  referenceWorkspace,
  AGENTS,
  SELF,
  WELCOME,
} from "./referenceWorkspace.ts";

test("reference sidebar contains only the installed workspace channels", () => {
  const { channels } = referenceWorkspace();
  assert.deepEqual(
    channels.map((channel) => channel.name),
    ["general", "Welcome", "welcome-everyone"],
  );
  assert.equal(channels[1].visibility, "private");
  assert.equal(channels[2].memberPubkeys.length, 2);
});

test("seeded replies and reactions resolve to real reference messages", () => {
  const { events } = referenceWorkspace();
  const ids = new Set(events.map((event) => event.id));
  assert.equal(ids.size, events.length);
  assert.equal(
    events.filter((event) => event.tags.some((tag) => tag[3] === "reply"))
      .length,
    3,
  );
  for (const event of events) {
    assert.match(event.id, /^[a-f0-9]{64}$/);
    assert.equal(event.tags.find((tag) => tag[0] === "h")[1], WELCOME);
    for (const tag of event.tags.filter((tag) => tag[0] === "e"))
      assert.ok(ids.has(tag[1]));
  }
});

test("mentions use Buzz's display-name syntax and exact member tags", () => {
  const { events } = referenceWorkspace();
  const mentions = events.filter((event) => event.content.startsWith("@Fizz"));
  assert.equal(mentions.length, 6);
  for (const event of mentions) {
    assert.equal(event.pubkey, SELF);
    assert.ok(
      event.tags.some((tag) => tag[0] === "p" && tag[1] === AGENTS[0].pubkey),
    );
  }
  assert.deepEqual(
    AGENTS.map((agent) => agent.personaId),
    ["builtin:fizz", "builtin:honey", "builtin:bumble"],
  );
});
