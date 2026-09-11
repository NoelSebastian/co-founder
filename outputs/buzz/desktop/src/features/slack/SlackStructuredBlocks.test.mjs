import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SlackStructuredBlocks } from "./SlackStructuredBlocks.tsx";
import { SlackAppActions } from "./SlackAppActions.tsx";
test("mixed Lovable paragraphs and table retain order and every numeric cell", () => {
  const blocks = [
    { type: "rich_text", elements: [{ text: "Before" }] },
    {
      type: "table",
      column_settings: [{}, { align: "right" }],
      rows: [
        [
          { type: "raw_text", text: "Pipeline" },
          { type: "raw_text", text: "Value" },
        ],
        [
          { type: "raw_text", text: "New business" },
          { type: "raw_text", text: "2,772,802.00" },
        ],
      ],
    },
    { type: "rich_text", elements: [{ text: "After" }] },
  ];
  const html = renderToStaticMarkup(
    React.createElement(SlackStructuredBlocks, {
      blocks,
      renderRich: (b) => b[0].elements[0].text,
      renderText: (t) => t,
    }),
  );
  assert.match(html, /<table/);
  assert.match(html, /2,772,802.00/);
  assert.match(html, /text-align:right/);
  assert.ok(html.indexOf("Before") < html.indexOf("<table"));
  assert.ok(html.indexOf("</table>") < html.indexOf("After"));
});
test("callback-only approvals are not falsely rendered as working local approvals", () => {
  const html = renderToStaticMarkup(
    React.createElement(SlackAppActions, {
      blocks: [
        {
          type: "actions",
          elements: [
            { type: "button", text: { text: "Allow once" }, value: "approval" },
            {
              type: "button",
              text: { text: "Details" },
              url: "https://lovable.dev/projects/example",
            },
          ],
        },
      ],
      onOpenSlack: () => {},
    }),
  );
  assert.match(html, /Allow once · in Slack/);
  assert.match(html, /href="https:\/\/lovable.dev\/projects\/example"/);
});
