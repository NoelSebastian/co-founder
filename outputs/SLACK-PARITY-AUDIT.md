# Current Slack validation status — 11 September 2026

This section supersedes older notes below. **Full Slack feature/design parity is not certified.** Native Buzz chat remains separate and unchanged by this pass.

## Follow-up completed: read markers and forwarding

Latest fixture inventory: `users.list` and `conversations.list` were fully exhausted (no next cursors). There are no other active human users, no group DMs and no Slack Connect conversations in this workspace. User was asked for an existing authorized test workspace/conversation to validate those cases. No other users were invited or messaged.

Forwarded-card layout was visually compared with Slack: rounded border, 36px original-author avatar, name/time, channel attribution, then message body. Automatic bot preview updates no longer display a misleading user-edited marker. Final TypeScript check passed.


- Corrected the earlier claim that marking a conversation unread requires opening Slack. The official `conversations.mark` method supports moving the authenticated user's cursor backwards. Tested first with the API and restored the original cursor, then used the app's right-click **Mark unread** action and confirmed Slack stored the preceding microsecond.
- Added a red **New** divider at the first unread message and the U shortcut. **Mark read** clears the divider. Thread-specific unread still opens Slack; it is not presented as a conversation cursor update.
- Reverse test: used Slack's own message menu to mark `Formatting QA: nested emphasis` unread. The app's divider moved to the boundary before that exact message without refreshing. Active-conversation read state is polled about every six seconds through supported APIs. Restored QA to read through the app.
- Forwarding now offers searchable, keyboard-accessible destination selection, an optional note, and an original-message preview before sending. Sending enables Slack's supported link previews. `Forwarding QA: adding a note while sharing the original message.` is retained in private #cofounder-slack-qa.
- Slack confirmed the sender's real identity and generated an `is_msg_unfurl` attachment. Verified note, original author, original time and original message in Slack itself and the app. The app now renders these message previews, including rich text.
- TypeScript and two read-cursor boundary tests passed. Existing backend validation tests passed. Multi-destination forwarding, all private-access permutations and full proprietary forwarding behavior are not claimed.

Sources checked: [conversation read cursors](https://docs.slack.dev/reference/methods/conversations.mark/), [message link previews](https://docs.slack.dev/reference/methods/chat.postMessage/), [retired saved-item and reminder APIs](https://docs.slack.dev/changelog/2023-07-its-later-already-for-stars-and-reminders). Slack documents that the old stars APIs do not affect Later, so these must not be used to fake Later synchronization.

## Verified in the running app and Slack

- Fresh app composer send: `Rich-text QA: a fresh send through the app.` displayed underlined in both app and Slack. Opened the app right-click menu, edited the message, saved, and verified underline remained in Slack.
- Reverse direction: `Slack-origin formatting QA: underline arrives in Co-founder.` composed and underlined in Slack itself appeared underlined in the app without refresh.
- `Emoji QA: :rocket: :shipit:` sent through the app rendered rocket and the canonical custom squirrel emoji in both interfaces.
- Underlined main draft survived a full reload. Underlined thread draft survived closing/reopening the pane, then sent as `Thread draft QA: preserve underline.`; Slack's replies API confirmed the connected user and underline block. The latter is a browser send plus API verification, not a separate Slack thread visual check.
- Image attachment now loads inline (verified the existing 320×160 PNG's natural dimensions). Clicking it opened the image viewer and its controls.
- Corrected the `(edited)` marker's placement beside ordinary message text.
- Existing reply summary remains avatar + bold blue count + last-reply timestamp.

## Reliability findings and fixes

- Rich-text sends exposed a real bug: PostgreSQL JSONB reordered nested object keys and the journal compared JSON strings. That falsely rejected a pending send as a conflicting request. Replaced it with structural comparison and added a database regression covering reordered blocks and real payload conflicts.
- Recovered the original pending underline test with its existing operation ID. Slack confirmed delivery. A subsequent fresh app send proved the fix through the app, not just a manually invoked backend action.
- Slack message events can confirm existing uncertain sends, fenced by workspace, authenticated user, channel, thread and client message ID. A late HTTP failure cannot downgrade a delivered operation. Database fixture tests cover these races; a forced browser transport-loss race remains unverified.
- Official Web API SDK test with a local HTTP fixture verifies persisted 429 cooldown, no request during cooldown, successful later recovery, and no automatic retry after a lost write response. This is not a Slack load test.

## Checks run after changes

- Frontend TypeScript: passed.
- Formatter/rich-text/layout tests: 10 passed.
- Backend credential/validation/download-capability tests: 5 passed.
- PostgreSQL operation journal regression: passed.
- SDK rate-limit/uncertain-network regression: passed.
- Authorized live self-DM regression: authenticated identity, duplicate request returning the same message, edit, reaction add/remove, exact file upload/download, fixture file cleanup, message deletion all passed. This script removes only its own disposable fixtures; the labelled visual test conversations remain.

## Feature checklist

| Area | Status | Practical limit |
| --- | --- | --- |
| Public/private channels and self-DM | Tested | Authorized private QA and existing public conversations |
| Group DMs | Implemented, not validated with multiple real people | No representative authorized multi-person fixture |
| History, replies, incoming updates | Tested basic navigation and thread flows | Exhaustive deep pagination and old-file combinations remain unverified |
| Send, edit, delete, reactions | Tested in app and/or live regression | Exact Slack interaction parity not claimed |
| Formatting and mentions | Tested common styles, underline, named mentions, lists/quotes conversion | Complex nested blocks, full pasted content and interactive app blocks are partial |
| Custom emoji | Tested app send and Slack rendering; reaction checks recorded below | Standard emoji rendering can differ with platform font |
| Files | Upload/download round trip, inline PNG and viewer tested | 10 MB limit; full Slack media viewer and all file types not equivalent |
| Search | Tested accessible message matches | Slack retention/access limits apply; exhaustive historical coverage unverified |
| Read/unread | Conversation read/unread tested both directions | Thread unread remains partial; active conversation polling about six seconds |
| Reconnect | Backend restart and incoming recovery tested | Browser transport-loss timing remains unverified |
| Saved items/reminders/reply notification settings | Opens Slack | No in-app bidirectional equivalent implemented |
| Forwarding | Note and Slack-generated original-message preview tested | One destination per send; not full proprietary forwarding parity |
| Slack Connect | Unverified | No accessible representative fixture |
| Interactive app messages, Organise, Connect to apps | Unavailable/partial | Not equivalent to Slack's proprietary client |
| Huddles | Link to Slack | Native calls deliberately excluded |

Exact indistinguishability cannot be promised with the current supported-API feature set. The remaining missing controls must be treated as product limitations, not hidden behind a parity claim.

---

## Earlier audit history

# Slack parity audit — 10 September 2026

This is not a full-parity certification. Live checks used the authenticated user's self-DM in Co-founder. No teammate received test messages. Native Buzz chat remains separate.

## Verified against the live Slack service

| Capability | Evidence | Limit |
| --- | --- | --- |
| Personal identity | Newly posted message user ID equals connected Slack user | Self-DM fixture |
| Duplicate send protection | Same operation ID returns the same Slack timestamp | Backend operation check, not simulated network loss in browser |
| Edit | Slack history contains changed text | Disposable fixture; rich editing UI still needs final recheck |
| Delete | Slack history no longer contains created fixture | Only newly created test message deleted |
| Standard reactions | Add and remove confirmed with Slack reactions.get | Self-DM |
| Custom reactions | shipit alias appears as squirrel in Slack UI; removed in Slack UI | Final reverse update in app needs recheck |
| File round trip | Upload through application backend; downloaded bytes exactly match source | Text fixture; visual previews not verified |
| File cleanup | Newly uploaded fixture deleted through Slack | Not a file-delete UI claim |
| Thread reply | Reply sent from side pane exists in Slack conversations.replies; Slack UI count becomes four | Body confirmed by API |

Executable live checks: `cofounder-backend/slack-live-validation.mjs`. It creates disposable self-DM fixtures and cleans them up on successful completion. This is a manually invoked integration test, not a fresh customer workflow or autonomous agent run.

## Browser interaction checks and fixes

| Area | Result |
| --- | --- |
| Thread layout | Replaced conversation-swapping view with separate right pane; main conversation stays visible |
| Main composer draft | Opening, sending in, and closing thread preserved unsent main draft |
| Overflow menu | Expanded ordering, grouping, shortcuts and focus styling toward supplied Slack reference |
| Menu to reaction picker | Found immediate-close focus bug; fixed and verified picker stays open |
| Custom emoji picker | Search and select shipit tested; canonical alias handling added |
| Message edit | Replaced plain textarea with formatting editor; final browser test pending |
| Forward | Uses dialog and official permalink; redesigned dialog needs final browser test |
| Thread draft persistence | Added tab-session storage; type checked, browser check pending |
| Thread pagination | Refresh retains previously requested page depth; browser pagination fixture pending |
| Thread uncertain writes | Reuses operation ID for same attempted action; frontend type check only |

## Remaining parity gaps / unverified behavior

- Full pixel comparison of composer, thread pane, menus, spacing, hover, focus and responsive layouts is incomplete.
- File attachment previews, image uploads, browser download flow and files in old threads need browser tests.
- Private channels, group DMs, Slack Connect and old paginated history require representative accessible fixtures; current workspace data has not covered them.
- Reconnect recovery and uncertain-send UI require browser/network interruption tests.
- Formatting combinations, mention insertion, list behavior, edit failure recovery and keyboard shortcuts need a complete interaction pass.
- Thread composer does not yet match the main composer in all controls; no resizable divider or also-send-to-channel option.
- Save for later, reminders, thread notification management and mark-unread menu actions explicitly open Slack. They are not native bidirectional implementations.
- Organise and Connect to apps menus are not implemented.
- Underline is unavailable in current mrkdwn composer; interactive Slack app messages do not have full native rendering/action parity.
- Forward shares a permalink, not an exact recreation of Slack's full forwarding experience.
- Search is bounded by Slack's accessible/retained data. Thread unread state is not fully synchronized.

## Regression results

- Frontend TypeScript check: passed after latest changes.
- Backend unit tests: 3 passed.
- PostgreSQL operation regression: passed (deduplication, uncertain outcomes, ownership boundaries).
- Live operation checks: identity, duplicate request, edit, reaction add/remove, file round trip, cleanup and message delete passed.

## Additional browser validation — same day

Browser access resumed after the Mac was unlocked. The locked-screen blocker is resolved.

- Short social channel: two messages are bottom aligned, eight pixels above the composer, with empty space above the conversation.
- Self-DM: app-origin message appeared in Slack UI under the connected user. Slack-origin reply arrived in app without refresh. Both labelled messages remain visible.
- Overflow fixture: 1,352px history inside a 951px viewport opened at the bottom (401px scrollTop; zero bottom gap).
- Reading older messages: PageUp moved to scrollTop zero. A new Slack-origin reply arrived without refresh; history grew to 1,412px and scrollTop remained zero.
- Thread draft: entered a temporary draft, closed the pane, reopened it and verified the identical text. Cleared the temporary unsent draft afterward.

Implemented a bottom-aligned, chronologically ordered conversation history. It follows new messages when already at the bottom and preserves reading position when scrolled up. Native Buzz history is unchanged.

Remaining work is the unresolved parity checklist above, particularly rich edit failure recovery, composer controls, previews, pagination fixtures and reconnect interruptions. These checks do not certify full parity.

## Editing validation — subsequent pass

Fixed premature edit dismissal: message actions now return delivery confirmation; the edit view closes only after a confirmed successful operation. Unconfirmed edits retain their text and show a notice. TypeScript passed. Browser successful-save test passed: changed the labelled scroll-position fixture in Co-founder, observed the edited text and edited marker in Slack itself, and confirmed the app edit view had closed. Browser failure simulation remains unverified.

## Extended interaction pass

- Rejected edit: submitted a 4,001-character edit; backend refused it. Browser retained all 4,001 characters and displayed the failure notice. Cancel restored the original message. Fixed lingering row notice on cancel.
- Image: uploaded `cofounder-slack-preview-test.png` through the visible attachment control. Confirmed the file in Slack's own UI and opened its media viewer.
- Preview: replaced oversized absolute overlay with a focus-managed dialog. Verified the 320×160 image remains 320×160 at 100%, zoom changes to 125%, rotation changes to 90°, reset works, and Escape closes the viewer. This is improved behavior, not a claim of exact Slack media-viewer parity.
- Download: backend byte-for-byte check passed earlier. Two browser download-event tests timed out, including after attaching the temporary download link to the document. End-user download completion remains unverified; do not count it as passed.
- Composer: replaced native emoji/mention selects with shared searchable popovers in channels and threads. Tested custom emoji search and insertion, person search, and readable mention tokens. Sent a real self-mention and verified the named mention in Slack.
- Formatting: selected text and applied Bold; browser DOM showed strong markup. Shift-Enter added a second line without sending. Enter sent one message and cleared the composer. Slack rendered its first line as a B element.
- Search: quoted exact phrase returned one matching message. Fixed raw mrkdwn and raw DM identifier in the result presentation. Results now show formatted message text, readable conversation title, author and timestamp.
- Restart recovery: stopped local backend, sent a labelled message in Slack, restarted the same backend (PID 23614). The missed message appeared in Co-founder without reauthorizing Slack. Search results remained intact. Fixed stale connection-error state independently of action errors.
- Retry reliability: conversation retries now reuse an in-memory request ID for the same unconfirmed action; confirmed failures and deliveries release it. Thread retries similarly release known failures. Backend deduplication regression already passed; client network-loss retry simulation is still unverified.

Latest frontend TypeScript check passed after the retry, mention, preview and picker changes. Existing public/private/group/Slack Connect limitations above remain; no new users or private channels were created.

Chrome browser automation fallback was unavailable when requested. Browser download completion remains unresolved.

## Latest verified state — 11 September 2026

Supersedes earlier pending notes where updated below. Not a complete-parity certification.

Tests used the authenticated self-DM and explicitly authorized private #cofounder-slack-qa (only the connected user).

- Channel and thread sends insert immediately and clear the composer before confirmation. No visible sending paragraph. Two consecutive messages and two replies were each confirmed once by Slack, under the correct identity.
- Right-click menu: thread, reaction, edit, forward and delete paths exercised. Escape dismisses the menu while retaining its thread in the subsequent DOM snapshot.
- Broadcast checkbox: confirmed thread_broadcast in Slack channel and thread; app shows a thread indicator.
- Edit and delete: changed text observed in Slack; disposable recovery-test message removed in Slack after app confirmation modal.
- Custom shipit reaction resolves to squirrel; standard rocket tested. Full standard catalog added alongside custom workspace emoji.
- Incoming Slack-origin message appeared without refresh. Search found four channel/thread matches.
- Rejected send: all 4,015 characters restored by Edit and retry; corrected message delivered. Failed draft survives conversation switching.
- Unsent draft survives conversation switching and full reload.
- Download now passed: browser download event succeeded and Downloads/cofounder-slack-preview-test.png exists, 550 bytes, valid PNG, 320×160; SHA256 ca5fb830c857f1df7617c640ad17b1a7021c48fce2ff90640642aa587d488d4a. Resolves earlier failed download checks.
- Download security: authenticated API issues a random, single-use, 60-second capability; tests cover expiry and consumption. Attachment response uses octet-stream and nosniff, with no Slack credentials exposed.
- Docker, database, frontend and backend restored on 11 September; Slack connection/history recovered without reauthorizing.
- Presentation: 15px/22px message text, grouped authors, 36px avatars, day separators, bottom-aligned short history, quote blocks, resizable thread. Not a pixel-perfect certification.

Remaining partial/unverified: complex rich text/underline, interactive app blocks, full media viewer parity, per-thread unread state, Later/reminders/reply notifications, Slack Connect, real multi-person group DMs, browser network-loss races, exhaustive rate-limit behavior. Several unsupported controls explicitly open Slack. Native Buzz messaging remains separate.

Final draft check in this pass: fixed the editor callback retaining an old draft key; clearing with normal editing keys persists across reload. TypeScript passed after the draft and quote updates. App left at the QA channel with an empty composer. Test download is saved; no additional customer files downloaded.
