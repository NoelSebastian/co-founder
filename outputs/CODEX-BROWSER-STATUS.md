# Codex browser integration — 9 September 2026

Implemented the product-owned browser worker using @openai/codex-sdk 0.153.4 and @playwright/mcp 0.0.80. The local proof uses the existing Codex CLI's ChatGPT authentication. No tokens were copied. Personal Codex configuration is excluded, and only an explicit browser tool list is enabled. The worker has a read-only command sandbox, a four-minute deadline, structured results and private event/screenshot artifacts. This is a local single-founder proof, not a hosted multi-tenant security boundary.

## Verified with real Codex and Chrome

- Dedicated worker reached the real private Lovable preview, observed the login redirect, captured a screenshot and returned blocked without inventing test results. Run 4e53c24d-fa21-4bd5-a51c-46bbf7107617.
- Working disposable app: the worker renamed a completed task and verified persistence after re-navigation. Passed. Run e85a88f4-5869-41e8-ab13-0079f3cda652.
- Deliberately broken disposable app: the worker observed rename and completion succeeding, then detected the name reverting after reload. Failed as expected. Run 55411769-8b80-46d1-bf13-3ed24eb3e34f.
- These runs used browser tools and visible UI, with screenshots; they were not hard-coded Playwright scenario executions or source-code inspection.
- Nine focused backend tests passed, including rejection of missing acceptance criteria. Frontend TypeScript passed.

## Product connection

feedback-worker.mjs now uses testFeedbackWithCodex for the checklist profile. The adapter requires seven named acceptance checks, binds evidence to the exact project/change IDs, streams browser activity into test_evidence, and holds drafts on blocked/failed runs. Existing manually verified draft remains unchanged. Other test profiles remain explicitly unsupported.

ThreadBuildProgress displays Codex browser activity during testing. Failed/blocked runs have an authenticated owner-only retry action. Completed draft records cannot be retried through that endpoint, preventing duplicate draft creation.

## Remaining account step

A separate Chrome window was opened using codex-browser-login.mjs, with the product's profile under work/backend-test/codex-browser/profile and loopback debugging port 5182. User needs to sign into Lovable there and leave it open. The worker reuses this product browser for Lovable. It never attaches to the default personal Chrome profile. Product tools and raw events can contain private page content; evidence stays under ignored work/.

Full real Lovable verification by the independent Codex worker remains blocked on that login. Do not claim unattended Lovable tests passed. The earlier seven-check Lovable result was assistant-driven via Codex desktop's separate signed-in browser.

## Next verification

Once the user confirms login, run testFeedbackWithCodex on the existing approved record without resetting its reply_ready state or creating another Gmail draft. Confirm all seven checks, screenshots, cleanup and session reuse. Then test a fresh customer journey with human chat approval.

## Operational limits

Local process and browser must remain running. The job loop, tenant isolation, cancellation UI, screenshot serving/live viewing, richer generic task acceptance, expired-session recovery and account-level production authentication need further work. Browser origin guidance is not a hardened security boundary. The current scope is the user-authorized local checklist demo. Hosted operation will need isolated workers/profiles and explicit service authentication.

Sources: https://learn.chatgpt.com/docs/codex-sdk ; https://github.com/microsoft/playwright-mcp

## Actual SSO attempt, 14:28 UTC

Implemented an explicitly opted-in normal sign-in mode (default remains off). Ran the product Codex worker against the dedicated browser: navigated to Lovable, clicked Google sign-in, reached the account noel.sebastian.somdalen@gmail.com, and stopped at Google's “Verifying it’s you… Complete sign-in using your passkey.” Screenshot independently inspected and confirms this blocker. Run 13608250-e055-4e55-a58c-8c339d889874. No app data changed. Three acceptance-gate tests and syntax validation passed. User must complete Google's passkey check to continue this route; don't claim the worker can supply that human verification itself.

## Real Lovable verification passed — 14:48 UTC

User showed the dedicated Chrome window displaying the actual Lantern app. Ran testFeedbackWithCodex against that product browser: all seven required criteria passed, 43 successful browser tool calls, screenshots captured, disposable task removed, original three tasks preserved. Run 17d7a2fa-89db-4d6c-9848-522bd69f25ce; Codex thread 01a086a2-ad3a-7871-aedc-e5daa19b6ba2. Evidence saved privately to lovable-verification.json and updated on the existing feedback record while preserving reply_ready and the original unsent draft. Earlier evidence backed up. No new build or email draft created. This proves the independent product Codex worker can test the real app using its connected browser session. Expired-login recovery and operation after the browser/laptop stops are not proven.
