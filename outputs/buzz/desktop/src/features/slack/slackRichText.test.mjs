import test from "node:test";
import assert from "node:assert/strict";
import { toSlackBlocks, fromSlackBlocks } from "./slackRichText.ts";
test("underline and combined marks survive the structured Slack round trip", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Important",
            marks: [
              { type: "bold" },
              { type: "underline" },
              { type: "italic" },
            ],
          },
        ],
      },
    ],
  };
  const blocks = toSlackBlocks(doc);
  assert.deepEqual(blocks[0].elements[0].elements[0].style, {
    bold: true,
    underline: true,
    italic: true,
  });
  assert.deepEqual(fromSlackBlocks(blocks), doc);
});
test("lists and named mentions retain structure", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "slackMention",
                    attrs: { id: "U123", label: "Noel" },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  assert.deepEqual(fromSlackBlocks(toSlackBlocks(doc), { U123: "Noel" }), doc);
});
test("unhandled Slack blocks use the message fallback instead of dropping content", () => {
  assert.equal(
    fromSlackBlocks([
      {
        type: "rich_text",
        elements: [
          {
            type: "rich_text_section",
            elements: [{ type: "channel", channel_id: "C123" }],
          },
        ],
      },
    ]),
    null,
  );
});

test("rich text sends known emoji and custom aliases without interpreting unknown codes", () => {
  const blocks = toSlackBlocks(
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: ":rocket: :shipit: :not_a_workspace_emoji:" },
          ],
        },
      ],
    },
    { shipit: "alias:squirrel", squirrel: "https://example.com/emoji.png" },
  );
  assert.deepEqual(
    blocks[0].elements[0].elements
      .filter((n) => n.type === "emoji")
      .map((n) => n.name),
    ["rocket", "squirrel"],
  );
  assert.ok(
    blocks[0].elements[0].elements.some(
      (n) => n.text === ":not_a_workspace_emoji:",
    ),
  );
});
