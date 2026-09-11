## Complete local MVP

Mission Control now supports shared founder priorities, AI-drafted PRDs, revision/approval, and real Lovable builds with preview links returned to chat. The complete two-user workflow was tested. See [MVP-TESTED.md](../MVP-TESTED.md) for how to try it, startup, evidence, and current limitations.

# Buzz browser frontend

## Real messaging test (2026-09-09)

The original chat UI now has a separate `live-test` development mode using Buzz's existing real-relay browser test harness. Start the isolated backend described in `../BUZZ-MESSAGING-TEST.md`, then run `pnpm dev:live:noel` and `pnpm dev:live:alex` in separate terminals. Open http://127.0.0.1:5174 for Noel and http://127.0.0.1:5175 for Alex, and select the corresponding account. Separate ports isolate the two users' browser storage.

Verified through the UI: both accounts sign in, both send/receive live messages, history survives a page reload, and Alex's thread reply appears for Noel. The real relay validates signatures and room membership; HTTP requests carry NIP-98 authorization rather than trusting the upstream test harness's X-Pubkey header.

This picker is deliberately local test access, not production authentication. It serves disposable test keys into browser memory from the local untracked fixture, and is restricted to same-origin POSTs on loopback ports 5174/5175. The Vite plugin is installed only in live-test mode and rejects deployment builds. No account secrets are bundled in source or static output. Other native/agent features in the upstream browser harness may still be simulated; the verified scope is messaging and threads. Port 5173 remains the separate visual mock preview.

Checks: `node --test desktop/local-session-plugin.test.mjs` and `pnpm --dir desktop exec tsc --noEmit`.

This project reuses the original React frontend from https://github.com/block/buzz,
including its components, fonts, icons, themes, and interaction logic. The source
is retained under its original Apache-2.0 license (see LICENSE).

## Run

From this directory, with Node 24+ and pnpm 11.4.0 installed:

```sh
pnpm install --frozen-lockfile --filter buzz...
pnpm dev
```

Open http://127.0.0.1:5173. The app starts in a local recreation of the installed lovable workspace, in welcome-everyone.

```sh
pnpm build
pnpm preview
```

The static build is written to desktop/dist. Buzz uses hash-based routing,
so channel links work on ordinary static hosts without route rewrites.

## What's connected

The browser demo runs the original desktop UI against Buzz's existing mock Tauri
bridge. It supplies sample channels, messages, members, and other fixture data.
This is a frontend preview: messages and most workspace changes are in memory
and reset on reload. Appearance preferences are stored in this browser.
Agents, voice calls, authentication, uploads, and collaboration are not connected
to live services. Mock success responses do not mean real actions took place.

The demo is enabled only by the explicit Vite `demo` mode. Standard desktop
production builds keep their original backend and exclude the demo bridge.
Use a separate origin for this preview, as its startup seeds community settings.

## Continue development

- UI and feature code: desktop/src/features
- Shared UI and styling: desktop/src/shared
- Demo startup: desktop/src/demo/configureBrowserDemo.ts
- Original native backend: desktop/src-tauri
- Original relay/backend setup: README.md and CONTRIBUTING.md

Reusing the source preserves the actual UI rather than approximating screenshots.
The README screenshots show a configured workspace and may precede the current
source revision; matching their exact content requires reproducing that workspace.

## Reference and fidelity

The installed macOS app reports version 0.5.23. Its matching source tag is
`desktop-v0.5.23` (`b9392d9d78744df365f9276e1ffe8c1baa5ea903`). Frontend changes
that had landed after that release were reverted to the tag. Existing visual
components and styles are retained from that release, rather than reimplemented.

The demo recreates the observed channel list, Noel profile, starter agents,
mention chips, reactions, thread previews, and configuration-error cards.
Agent avatars were extracted losslessly from the native Rust persona definitions.
The reference is a local snapshot, not a live mirror; subsequent activity in Buzz
will not automatically appear here. Message timestamps and some reference state
are reconstructed for visual comparison, not an export of authoritative records.

Browser menus use Buzz's browser fallback. Native window controls, desktop
vibrancy, file pickers, voice, GIF search results, and live agent operations cannot
be certified as one-to-one while using the mock backend. The GIF tab is exposed
using local capability metadata and reports that a connection is needed. No
production credentials or real relay identity were copied. Full native parity
requires the Tauri shell and connected backend retained in this repository.

## Verification status

Dependency installation, TypeScript checking, and the static demo build passed.
The built app was visually inspected in a browser at 1280 × 720. Fresh startup
into the general channel, sending a message, opening a thread, sending a thread
reply, and opening search were verified. The installed channel, thread, agents, profile-menu, and appearance surfaces were also inspected. Three reference-data tests pass. Source comparison confirms the original UI component/style implementation is retained; an exhaustive screenshot-diff certification of every state has not been completed. The original build reports large bundle
warnings; these do not prevent the build or preview from working.

## Shared chat agent (2026-09-09)

The original Buzz agent runtime is now running separately on the backend, using OpenRouter. In the Co-founder test channel, type `@` and select Co-founder. Its real replies appear in threads. Noel and Alex both successfully mentioned it, shared context, and recovered its replies after browser reloads. See `../CHAT-AGENT-TEST.md` for evidence, startup instructions, and limitations. The Agents management page is still backed by the browser harness; use the channel for this test. Lovable and durable build jobs are not connected yet.
