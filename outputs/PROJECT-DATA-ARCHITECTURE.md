# Shared project data

All registered project agents inherit read and write access to connected project data, including future sources. The owner can restrict access in Agents → Project data access. This is separate from conversation membership: agents still need to join a conversation to participate.

The backend is the authority. Every tool request authenticates the agent, resolves the source and checks current permissions. Matching project, source and agent restrictions combine using the most restrictive access level (none, read, write). Hiding a business page does not revoke its connection. Revocation stops subsequent tool access but cannot erase data already shared in chat.

The shared project-data command discovers sources and invokes connector operations. Each agent receives its own credential, mounted read-only into that agent's container. The host credential directory is owner-only. A file mount is necessary because Buzz deliberately clears environment variables when launching tool subprocesses. Connector credentials remain in the backend.

Meridian currently supports live pipeline summaries, record reads and selected deal-field updates. Embedding an arbitrary app does not itself connect its database: unconfigured sources are explicitly reported as display-only. Additional connectors should implement the same gateway contract rather than special Co-founder prompts or unrestricted database access.

Permission changes and data operations are recorded in the activity log. Writes record their start before calling the remote service and their confirmed completion or failure afterward. Connector-supported writes still require a user-requested change; default write permission is not an instruction to modify data autonomously.

## Verification on 2026-09-10

- Seven configuration, permission and pipeline-summary unit tests passed.
- Direct permission checks rejected writes under read-only access and reads under no access.
- A credential-cleared tool subprocess running as the container's non-root user retrieved Meridian successfully.
- A fresh Co-founder DM using meta/muse-spark-1.3 fetched and returned 28 open deals, open value 2,772,802 and weighted forecast 1,208,620.75, matching the direct live-data check.
- This verifies the live chat-to-Meridian read path. It does not establish that all connectors or remote-write workflows are end-to-end verified.
