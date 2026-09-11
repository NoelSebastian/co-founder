> Latest implementation and end-to-end results: [MVP-TESTED.md](MVP-TESTED.md). The record below describes the earlier integration stage.

# Shared chat agent integration

The original Buzz `buzz-acp`, `buzz-agent`, and `buzz-dev-mcp` binaries are reused unchanged through the official Sprig container. Image revision matches the relay and source checkout: `c045321a7fb3ca8939f28519ce7a555a6f597728`.

Pinned image: `ghcr.io/block/buzz-sprig@sha256:55589713278d3ad52610bc965e3e94bc91460c2e18896ebdc55f50b5320398c1`.

## Verified

- Provisioned a separate Co-founder identity and invited it to the existing private Noel/Alex room.
- Ran the original harness with model execution disabled by `--respond-to nobody`.
- Logs confirmed connection, membership subscription, discovery of the correct private room, and online presence.
- Stopped the connection-only container after verification. No model calls were made.

## Live OpenRouter test — passed 2026-09-09

After the user configured and authorized OpenRouter, started the same upstream container with its Noel/Alex allowlist. Browser testing used the original Buzz mention picker and composer:

- Noel mentioned Co-founder with a fictional onboarding project called Lantern.
- Co-founder posted a real Claude Sonnet 4.5 response through OpenRouter in the correct thread, recommending interviews with 3–5 teams.
- Alex opened that thread in a separate authenticated browser session and mentioned the same agent, asking it to recall Noel's project and its recommendation.
- Co-founder correctly named Lantern and recalled the interview recommendation. Noel saw Alex's question and the reply live.
- Reloaded both browser sessions, reopened Noel's thread, and verified the exact saved response in both sessions.
- Runtime logs confirmed four successful OpenRouter calls: tool-use and completion rounds for each of the two requests. No fake model responses were used.

The service remains running locally. Use the Co-founder test channel at port 5174 (Noel) or 5175 (Alex), type `@`, and select Co-founder. Replies appear in the thread. The provider key is stored only in the private backend configuration, not frontend source.

## Start after configuring OpenRouter

Enter a key locally in `work/backend-test/openrouter.env` (mode 0600, outside the Buzz source repository). The default model is adjustable. Never put the key in frontend code or chat.

```sh
node outputs/start-chat-agent.cjs
```

The launcher refuses an empty key. The agent permits Noel and Alex via Buzz's existing author allowlist. It listens for mentions, queues overlapping requests, and includes up to 30 context messages. Turn duration, tool rounds, output size, memory, CPU, processes, and logs are bounded. The container mounts no laptop files or Docker socket. This local test uses Docker Desktop host networking to preserve the relay's exact community URL.

## Still unverified / not implemented

OpenRouter configuration follows its [official API documentation](https://openrouter.ai/docs/api_reference/overview). The live test above covers replies, mentions, shared thread context, and saved replies. It does not certify every agent feature or every failure case.

The upstream model calls are non-streaming. This setup does not add a durable job queue or guarantee recovery of in-flight work after a runtime crash. Completed messages are stored by the relay. Production credential management, deployment supervision, durable build jobs, PRD artifacts, and the Lovable bridge remain follow-up work. The existing Agents management page still contains test-harness functionality; this service is not managed through that page yet.
