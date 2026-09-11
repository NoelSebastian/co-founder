# Co-founder MVP — tested September 9, 2026

## Try it

- Noel: http://127.0.0.1:5174
- Alex: http://127.0.0.1:5175
- Completed example: https://id-preview--f15dee08-058b-4f62-a23e-f6b31f0a7e3e.lovable.app

Use the **Co-founder test** channel. The original Buzz messaging frontend and backend are real; these sessions have simple disposable local test accounts.

1. Start a conversation describing a small app. Mention **Co-founder** using the `@` picker to discuss it.
2. Open **Mission Control → Shared PRDs → New PRD**. Select that conversation, add a title, and choose **Ask Co-founder to draft**.
3. Review and edit the saved draft. Noel and Alex see the same document. Save edits, then **Approve version**.
4. Choose **Build with Lovable**, or return to that conversation's thread, select **Lovable** from the `@` picker, and type **build**.
5. Watch **Mission Control → Builds** or the thread. The completed build returns a preview link.

Each approved version has one unique build job. Repeating the request returns the existing job. Editing produces a new unapproved version. Starting a build consumes credits in Noel's connected personal Lovable workspace. New approved versions currently create separate prototype projects; an in-place revision workflow is not implemented.

The **Lantern onboarding checklist** example is already complete. Its preview was reset to three starter tasks for you to try.

## End-to-end evidence

- Noel posted a real checklist-app brief through Buzz's composer.
- OpenRouter generated a PRD from that conversation.
- Alex loaded the same PRD, reviewed it, and saved version 2.
- Noel's attempt to save stale version 1 was rejected with a conflict; Alex's changes remained intact.
- Noel approved version 2 and invoked `@Lovable build the approved PRD.` through the actual mention picker in the original thread.
- Lovable created project `f15dee08-058b-4f62-a23e-f6b31f0a7e3e` through the authenticated MCP connection.
- Job `e13b33ec-c3dd-4aaa-9443-226da874d688` persisted in Postgres. Restarting the workflow backend resumed tracking the same project.
- Alex repeated the build request; the existing unique job was returned. There was still one job/project for that brief version.
- Lovable's completion was recorded and the preview posted into the original thread. Clicking the chat link opened the working preview in a new browser tab.
- The generated app passed: three initial tasks; add a task; complete a task and update progress; reload and retain that state; delete a task; reject a whitespace-only task; reset and retain the reset after reload.
- Both local sessions were reloaded after the backend restart. The shared priority, PRD, and completed build remained available.
- Mission Control was visually inspected in the browser. A transient render error occurred during active Vite edits; it did not recur in the final reload/thread/link checks. No exhaustive desktop-wide UI certification is claimed.

## Automated checks

Desktop TypeScript and local session endpoint tests pass. Backend tests cover signed actor/URL/method/body binding, expiry, replay rejection, outsider rejection, stale approval/build versions, draft-before-approval rejection, explicit build-command parsing (including rejection of negation), and Lovable's nested completion status.

```sh
node --test outputs/cofounder-backend/auth.test.mjs outputs/cofounder-backend/commands.test.mjs outputs/cofounder-backend/integration.test.mjs
```

Integration tests require the existing local backend to be running. They do not call Lovable or generate paid builds.

## Resume locally

From this project directory, with Docker Desktop running:

```sh
node outputs/start-mvp.cjs
```

The startup command was tested. It resumes the isolated Docker stack, original Buzz chat agent, workflow backend, and both frontend sessions. It does not reset the existing users, rooms, or database. Do not run the earlier messaging smoke-test setup to resume: that setup creates a fresh room.

## Infrastructure and limits

- **Local:** original Buzz Rust relay, Postgres 17, Redis 7, MinIO, original Sprig chat-agent runtime, the Node workflow adapter, and the Buzz React frontend.
- **External:** OpenRouter inference and Lovable's build/preview service. The app is not deployed as a public multi-user service. A localhost link only works on this laptop.
- **Storage:** original Buzz tables for messages; a separate `cofounder` schema in the same test Postgres for PRDs, immutable revision bodies/approvals, jobs, priorities, command deduplication, and a signed-message outbox. No Buzz messaging service was rewritten.
- **Authentication:** fixed local Noel/Alex identities with signed requests. OpenRouter secrets and Lovable OAuth remain on the backend. This is not production email/SSO or a per-user Lovable connection flow.
- **Build recovery:** queued jobs and remote IDs survive restarts. A crash during an ambiguous dispatch is marked **Needs attention**, never automatically re-dispatched. Status tracking has a 30-minute bound. This avoids claiming exactly-once execution across Lovable's external API.
- **Scope:** one test workspace and its private channel; latest 100 messages are available to the PRD conversation picker. The worker handles one build at a time. Deployment, production admission controls, backups, distributed workers, and load testing remain future work.
- **Teams:** Sales, Marketing, and HR roles/connections have a frontend overview marked **Planned**; those external connectors are not functional. Other native management controls in Buzz's browser test harness remain simulated. Use chat and Mission Control for this MVP.
- **Generated prototype:** Lantern is frontend-only and uses its own localStorage key. It is an example output of the workflow, not a replacement for Co-founder's shared backend. It was not publicly published through Lovable's publishing operation.
- **Excluded:** company computer, autonomous founder coaching, full departmental connectors, and hosting Co-founder online.

Private state and logs live under `work/backend-test`. Do not commit or share that directory. The OpenRouter key was pasted into the conversation; rotate it after testing and replace it locally in `openrouter.env`.
