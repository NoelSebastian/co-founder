import test from "node:test";
import assert from "node:assert/strict";
import { slackMarkdown, documentFromSlack } from "./slackFormatting.ts";
test("nested bold and italic survive editing without becoming literal markers", () => {
  const doc = documentFromSlack("*_Important_*", {});
  assert.deepEqual(doc.content[0].content[0].marks.map((m) => m.type).sort(), [
    "bold",
    "italic",
  ]);
  assert.equal(slackMarkdown(doc), "*_Important_*");
});
test("literal angle brackets and ampersands remain text through a round trip", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "A < B & C > D" }] },
    ],
  };
  const encoded = slackMarkdown(doc);
  assert.equal(encoded, "A &lt; B &amp; C &gt; D");
  assert.equal(
    documentFromSlack(encoded, {}).content[0].content[0].text,
    "A < B & C > D",
  );
});
test("mentions, lists and quote paragraphs preserve Slack semantics", () => {
  const text = "Hello <@U123>\n• First\n• Second\n> A quote";
  assert.equal(
    slackMarkdown(
      documentFromSlack(text, { U123: { id: "U123", name: "Noel" } }),
    ),
    text,
  );
});
