# Lovable inside Co-founder’s Slack interface

Implemented September 11, 2026. Native Buzz messaging remains separate.

## Architecture

Use the official **Lovable in Slack** application, not a locally impersonated agent. Human requests travel through the existing authenticated Slack user connection. Lovable receives those messages on its own infrastructure and replies in Slack threads; the existing independent Slack synchronizer displays them in Co-founder. No local AI session is required for delivery.

No project is hard-coded into this integration. A user may discover projects, create apps, edit accessible apps, and query their data subject to Lovable’s workspace permissions. Meridian is a validation fixture only. The official application ID is verified independently of its display name to prevent matching an unrelated bot named Lovable.

## Setup and use

1. Connect the user’s Slack account in Co-founder’s Slack settings.
2. In that same settings view, use **Lovable → Connect or manage Lovable**. This opens the official Lovable workspace connection flow. Connect the intended Slack workspace there.
3. Return and select **Open Lovable in [workspace]**. The app discovers the official bot across paginated Slack users and opens its real DM.
4. For channel collaboration, open the channel and select **Add Lovable**. This uses the current user’s Slack permissions to invite the official app and inserts a real mention. Existing members are handled idempotently. Every new channel request must mention Lovable.
5. Ask naturally for a new project, an edit, or a data question. Replies and progress stay in the corresponding Slack thread.

Lovable’s own workspace permissions, billing/credits, and data scope apply. Channel conversations use workspace-shared context; DMs can use personal context. The connection is workspace-wide, not restricted to Meridian.

## UI changes

- Added official connection-management and DM discovery to existing Slack settings.
- Added channel invitation and real mention insertion.
- Resolve newly installed app identities without a page reload; preserve bot names and avatars in messages.
- Render structured Slack tables, sections, context, headers, images, and agent task cards in source order, alongside rich text.
- Preserve direct URL buttons. Callback-only interactive buttons explicitly open the source message in Slack; they are not simulated locally.
- No invented completion state: task-card status reflects Slack’s payload and does not imply the whole app build succeeded.

## Verified evidence

These were fresh product runs through the browser UI, not only manually started backend jobs:

- Connected the official Lovable app to Co-founder Slack. Lovable acknowledged the connection in its DM.
- In-app connection shortcut discovers the official bot and opens its DM.
- Project discovery reached 25 accessible projects, including Meridian, Lantern and Founder Priorities. Lovable initially searched only Meridian; a follow-up corrected the query scope.
- Meridian live query: active pipeline `18d671e5` returned 28 open deals and value 2,772,802.00, matching an independent read through the existing Meridian connector. Stage values match too. Lovable’s database scope also sees other seeded pipelines; those must not be confused with this account-scoped active pipeline.
- Created a separate unpublished project through the integrated Slack DM: `1b6449bf-84df-425e-8fd9-9e03cb1dbfdc` (Lovable named it **My Daily Notes**).
- Independently used that app’s live browser preview to add a note, edit its title, refresh, and confirm persisted title/body.
- Added Lovable to private `#cofounder-slack-qa` using the new in-app control. Sent an actual mention; Lovable replied in its thread. Confirmed sender identity and the mention in Slack itself.
- Uploaded synthetic `sample-pipeline.csv` via the app; Slack confirmed exactly one file (`F0C20CDMMC0`). Browser automation stalled after upload, so delivery was checked before any retry.
- Mixed database tables and progress task cards render in the real in-app thread; confirmed rows and values in the browser.
- Backend restarted and the existing Slack conversation flow recovered.
- Eleven focused frontend tests passed, including formatter regressions, official identity matching, safe app URLs, mixed table rendering, and honest callback-button fallback; TypeScript checks passed.

## Limitations and pending validation

- Native Slack callback approvals and modals cannot be invoked via this app’s public Web API connection. Open Slack for those controls; URL-based Review/Details links work directly. Ephemeral Slack-only approval prompts may not appear in message history.
- Slack Connect and slash commands are not supported by Lovable’s official integration.
- Publishing, external connector changes, video generation, and paid-plan Slack assistant surfaces were not exercised. No production project was publicly published for this test.
- The initial search-edit request failed upstream in Lovable. A focused follow-up completed it. Independently verified the resulting preview: uppercase title and body searches matched, an unmatched query showed a no-results state, and the previously saved note survived refresh. This demonstrates recovery through the same Slack thread; it does not guarantee every build succeeds first time.
- Attachment reading passed: Lovable correctly returned 2 rows and a value sum of 3,500 from the uploaded synthetic CSV. Native generated-file delivery did not pass: it returned CSV text and said it could not attach a sandbox-generated file under the requested no-project-change constraint. A screenshot artifact appeared in the Lovable project, but its delivery as a native Slack attachment remains unverified.

## Reference

- https://docs.lovable.dev/integrations/lovable-for-slack
- https://docs.lovable.dev/integrations/slack
- https://docs.slack.dev/interactivity/handling-user-interaction/

## Business-page preview limitation (2026-09-11)

New-page chat dispatch and project creation were verified with Page Flow Counter (`aa411508-5d3c-4416-a543-bcc3d9414ea3`). Private preview works in a first-party browser tab but redirects to Lovable sign-in in an iframe. Its offered authentication handoff returned to the dashboard and did not unlock the iframe. The official MCP `get_project` returns an unsigned preview URL, not an authenticated embedding URL.

The business page now keeps Lovable chat open on reopening and replaces the unusable private iframe with an explicit Open in Lovable action. This is an honest fallback, **not completion of seamless private embedding**. Public/published app URLs still embed. Browser verification confirmed the conversation remains visible and the sign-in iframe is absent. TypeScript and private-preview URL classification tests passed.

Feedback Hub (`b290a389-9559-4f77-bc79-f5c6afbaae78`) was still “Enabling Cloud for persistence” in Lovable; its preview reported no deploy. Do not call that app built solely because its project was created.

Public, expiring share-preview links are a documented alternative but widen preview access to anyone holding the link. None were created and no project was published as part of this fix.

## Full editor embedding experiment (2026-09-11)

Test harness: desktop/public/qa/lovable-editor-embed.html on localhost:5174, embedding the actual Page Flow Counter editor. Lovable's editor itself loaded. Initial state required login; Continue with Google completed using the existing account session, and the real editor chat appeared. Authentication survived a full harness reload. However, the editor's nested static-preview-panel reported “refused to connect.” Therefore the full editor iframe is not verified as a usable in-app builder. No app contents, visibility, or publishing settings were changed by this test.
