> Latest implementation and end-to-end results: [MVP-TESTED.md](MVP-TESTED.md). The record below describes the earlier integration stage.

# Co-founder: Lovable bridge proof

Verified 2026-09-09. This is a feasibility record, not the application implementation plan.

## Agreed product scope

- MVP 1: colleagues and agents in shared rooms; research and discussion become an agreed PRD; @Lovable hands it to the builder and brings results back. Include Mission Control for founder priorities.
- Represent departmental rooms, agent roles, and connector configuration in the frontend. Deep sales, marketing, and HR integrations can follow.
- Deliberate co-founder coaching is lower priority.
- The persistent company computer moves to MVP 2.
- OpenRouter is the intended candidate for chat-agent inference; no API key has been configured or verified.

## Live integration result

Authenticated the requested Google-linked Lovable account and verified identity and workspace access. Used the personal workspace Noël's Lovable for a small, unpublished integration test.

- Project: f4978cdc-359f-426f-8ae8-8b414b8c2a78
- Editor: https://lovable.dev/projects/f4978cdc-359f-426f-8ae8-8b414b8c2a78
- Preview: https://id-preview--f4978cdc-359f-426f-8ae8-8b414b8c2a78.lovable.app
- First instruction: create a frontend-only list of three founder priorities, with completion checkboxes and a completed count.
- create_project returned a project ID, message ID, and preview URL. get_message reported response.status=completed.
- First commit: fbc8a61e90dee3543390c7d9eac0f6252206a46b. Reported cost: 0.5 credits.
- Follow-up instruction: add Reset priorities to clear completed states and reset the count.
- send_message accepted the request; get_message reported response.status=completed.
- Revision commit: 80a16b21cdf4f8095caa419e35d058a16814f216. Reported cost: 0.4 credits.
- get_diff independently returned the reset function and button wired to its click handler.
- Lovable reported successful builds for both requests. Browser interaction testing remains unverified because the preview requires a separate browser login.
- The project was created private and unpublished. No publishing operation was requested.

## Integration details that affect the plan

- Native Codex OAuth login failed with a protected-resource metadata error. mcp-remote 0.8.5 completed OAuth successfully. The working helper was saved as the local Lovable MCP connection.
- This authenticates the development tooling. Co-founder's own backend will still need its own user connection and credential lifecycle; do not embed development credentials in the frontend or repository.
- Use asynchronous requests and persist project/message/thread IDs for later polling. A get_message response can have top-level status=running while response.status=completed; the nested response status is decisive according to the server reference.
- A returned preview URL does not mean the build has finished or that the preview is anonymously accessible.
- Resolve a selected project/workspace and an approved version of the brief before dispatching a build. Room membership must not implicitly grant access to every project accessible to the connected account.
- Verify cancellation, concurrent requests, reconnect recovery, and longer-term deduplication separately. This small proof does not establish them.
- The local Buzz preview remains a simulated frontend. The proof has not yet been wired into its chat UI.

## References

- https://docs.lovable.dev/integrations/lovable-mcp-server
- https://mcp.lovable.dev/skill.md

