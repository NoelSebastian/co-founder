import test from "node:test";
import assert from "node:assert/strict";
import { signed } from "./relay.mjs";
import { humans, assistant } from "./config.mjs";
import { isChatApproval } from "./feedback-chat.mjs";
const event = (
	content,
	who = humans[0],
	tags = [
		["h", "room"],
		["e", "thread", "", "reply"],
	],
) => signed(who, 9, content, tags);
test("chat approval requires a signed human yes reply, not discussion or agent output", () => {
	for (const s of ["yes", "Yes!", "YES.", " yes "])
		assert.equal(isChatApproval(event(s)), true);
	for (const s of [
		"no",
		"yes but change it",
		"she said yes",
		"yesterday",
		"yes?",
	])
		assert.equal(isChatApproval(event(s)), false);
	assert.equal(isChatApproval(event("yes", assistant)), false);
	assert.equal(isChatApproval(event("yes", humans[0], [["h", "room"]])), false);
	assert.equal(
		isChatApproval({
			...JSON.parse(JSON.stringify(event("no"))),
			content: "yes",
		}),
		false,
	);
});
