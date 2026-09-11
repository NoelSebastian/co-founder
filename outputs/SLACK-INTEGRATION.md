# Slack integration: implementation and validation

## Product boundary

Slack is an additional toolbar destination. Native channels, DMs, agents, relay storage and existing workflows remain separate. Slack is authoritative for Slack messages. The integration uses user OAuth tokens, never a substituted bot token, and does not depend on an LLM or an agent session.

Initial deployment: personal/internal use in the Co-founder Slack workspace. App UI remains React/Vite on localhost:5174; the Node service on localhost:5180 owns Slack connections and PostgreSQL stores credentials and the operation journal. Socket Mode receives updates while the backend runs. A separate callback-only listener on localhost:5191 supports HTTPS OAuth forwarding without exposing other API routes.

## Foundation comparison

| Foundation | Fit and limitations | Decision |
|---|---|---|
| Official Slack Node SDK, user OAuth, Web API and Socket Mode | Matches existing Node service, supported personal identity, no separate desktop client. Requires app registration, scopes and HTTPS OAuth callback. | Selected for internal use. |
| Beeper Desktop API | Local unified messaging; requires Beeper Desktop running, history may initially be limited. Network capabilities including Slack Connect and threads require validation. | Not selected; no Beeper dependency introduced. |
| MSGA | Existing C++/Qt Slack client, GPL-3.0. Documents app OAuth/Socket Mode and browser-session authentication. | Interface/reference only; no code copied or browser credentials adopted. |
| mautrix-slack | Matrix puppeting bridge; adds Matrix homeserver/bridge infrastructure and a different synchronization model. Personal-session authentication may involve session cookies. | Not selected; no Matrix server introduced. |

Sources:
- https://github.com/slackapi/node-slack-sdk
- https://docs.slack.dev/authentication/installing-with-oauth/
- https://docs.slack.dev/apis/events-api/using-socket-mode/
- https://docs.slack.dev/apis/web-api/rate-limits/
- https://developers.beeper.com/desktop-api/
- https://github.com/punarinta/make-slack-great-again
- https://github.com/mautrix/slack
- https://docs.mau.fi/bridges/go/slack/authentication.html

Socket Mode is not currently eligible for public Slack Marketplace listing. Commercial distribution needs a fresh eligibility/rate-limit review and an HTTP Events API deployment; do not assume internal-app throughput carries over. No undocumented Slack endpoints or browser-session cookies are used by this implementation.

## Setup

1. Start the existing local app and backend. The backend creates the Slack tables automatically.
2. Open Slack in the app toolbar, then **Set up Slack application**.
3. Provide an HTTPS endpoint forwarding only to `http://127.0.0.1:5191`. Its callback path must be `/slack/callback`. Temporary tunnel use requires owner approval; a stable hostname is preferable for ongoing use.
4. Enter that HTTPS callback URL and download the generated Slack manifest.
5. At https://api.slack.com/apps, create an app from that manifest in the intended workspace. Review permissions in Slack before installation.
6. Under Basic Information, retrieve Client ID and Client Secret. Under App-Level Tokens, generate a token with `connections:write`. Socket Mode is enabled by the manifest.
7. Enter those values in the in-app setup form and save. The backend encrypts them; it does not return saved secrets to the browser.
8. Click **Connect Slack account**, review user permissions and approve OAuth. The callback verifies the user identity and returns to the app.
9. Check the selected workspace and live-connection status. Use only an explicitly authorized test conversation for write validation.

Keep the backend running for incoming event collection. Keep the HTTPS callback host reachable for new connections/reconnections. Restarting a temporary tunnel can change the hostname, requiring updates in both Slack and application settings.

## Reliability and credential handling

- OAuth state is random, hashed in storage, expires after ten minutes and is consumed once. Connections are bound to the signed-in local user.
- User tokens and application secrets use AES-256-GCM. The encryption key is in an owner-only local directory, outside tracked source; back it up securely if preserving the database.
- Socket events are persisted before acknowledgment. They invalidate views; message data is fetched with each person's own token and is not broadcast between local users.
- Web API rate-limit cooldowns are persisted per workspace/method. SDK automatic retries are disabled for writes.
- Message operations have persistent request IDs and a journal. A confirmed response is shown as sent. Interrupted writes are uncertain, not automatically retried. Reusing a request ID does not send again. Exactly-once delivery cannot be guaranteed across a remote network failure.
- On restart, in-flight writes become uncertain. Pending operations are retained; a full autonomous pending-outbox worker is not implemented yet.
- The visible conversation refreshes from event invalidation, with periodic reconciliation. This is not a complete offline archive or guaranteed gap-free historical cache.
- Access-revoked conversation failures clear the visible history. Slack remains responsible for current authorization on every request.
- Credentials are not exposed to the business-agent gateway.

## Feature checklist — 2026-09-10

**No live Slack account has completed OAuth yet.** Implemented does not mean validated against Slack.

| Feature | Implementation | Validation / limitations |
|---|---|---|
| Separate Slack toolbar and setup screen | Implemented | Browser checked; native navigation remains available |
| OAuth, encrypted credentials, reconnect/disconnect | Implemented | Encryption tests passed; live OAuth pending |
| Public/private channels, DMs and group DMs | Implemented with cursor pagination | Real access coverage pending |
| Message and thread history | Implemented with cursor pagination | Old-thread and retention coverage pending |
| Incoming updates | Socket Mode invalidation + automatic view refresh | Live reconnect/gap recovery pending |
| Send and thread reply as user | Implemented | Journal duplicate/uncertain tests passed with stubbed Slack responses; actual identity pending |
| Create DM/group DM | Implemented | Live test pending; up to eight selected other users |
| Edit/delete own messages | Implemented with ownership check | Another-user deletion rejection tested locally; live tests pending |
| Reactions/custom emoji | Implemented | Live alias/custom emoji test pending; standard emoji text presentation needs refinement |
| Upload/download/image preview | Implemented with 10 MB application limit | Live tests pending; larger files open in Slack |
| Search | Slack search with pagination | Subject to granted scopes, plan retention and Slack indexing; no local complete archive |
| Mentions, text formatting, identities, time | Common mrkdwn and user mentions implemented | Full Block Kit, nested formatting and all special mentions are partial |
| Conversation read marker | Explicit Mark read API; metadata refreshed for active conversation | Live marker synchronization pending; workspace-wide unread counts partial |
| Thread unread state | No separate marker implementation | Unavailable; do not infer it from channel read state |
| Slack Connect | Accessible shared conversations are labeled | Partner workspace access, file and event coverage not validated |
| Interactive app messages | Text/attachment display only | Actions/forms open in Slack; not executed by this client |
| Calls/Huddles | Open conversation in Slack link | Native call/huddle implementation out of scope |

## Checks run

- Desktop TypeScript check (after generated route refresh).
- `node --test slack.test.mjs`: encrypted-secret roundtrip/tamper rejection, action validation, personal-token manifest.
- `SLACK_DB_TEST=1 node --test slack.integration.test.mjs`: isolated Postgres fixtures, stubbed Slack responses; cross-account rejection, concurrent duplicate journal use, no resend after uncertainty, rejection of another user's message deletion.
- Browser check of new toolbar entry and unconnected setup screen.

## Required live acceptance run

After OAuth, identify an authorized test conversation. Compare against Slack itself: public/private channel visibility, DM/group DM creation, old thread pagination, own identity on sends, reply, edit, delete, standard/custom reactions, upload/download/preview, search, explicit read marker, access removal and Socket Mode disconnect/reconnect. Verify native chat and agents still work. Record evidence and update the checklist instead of marking untested features supported.

## Live validation — September 10, 2026

Personal OAuth connected to Co-founder. Verified channel history, sending to the authenticated user's self-DM, and incoming Slack messages without manual refresh. A fresh self-DM conversation and thread exchange were verified in both Co-founder and Slack. Bold rich-text sending and editing an integration-originated reply succeeded. Backend restart recovered message access. This is a self-DM test, not a two-user/group/private-channel validation.

Slack navigation now lives below native Direct messages in the shared sidebar. The separate inner conversation sidebar and top Slack destination were removed. The composer uses the existing Tiptap dependency with bold, italic, strike, links, lists, quotes, emoji insertion, mentions and file selection. Underline is disabled because Slack mrkdwn cannot preserve it; code controls are omitted. Audio/video recording and scheduling are not implemented. Files and all remaining formatting variants still need live validation.

### Floating message toolbar

Added hover/focus highlight and top-right floating toolbar: ✅ 👀 🙌 quick reactions, reaction picker, thread reply, forward, bookmark, overflow (copy link/open Slack/edit/delete own message). Quick reaction addition in Co-founder was verified in Slack; removal in Slack was verified in Co-founder without refresh. Forwarding a message link to the self-DM was verified in Slack under the authenticated user. Forwarding shares a permalink rather than cloning Slack's proprietary forwarded-message presentation. Bookmark opens the original message in Slack: Slack Later has no supported public API, so no local saved state is presented as synchronized. See https://docs.slack.dev/reference/methods/stars.add/ .
