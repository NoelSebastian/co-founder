# Buzz messaging backend verification

Date: 2026-09-09

## Result

The unmodified official Buzz backend passed the initial real messaging test. Three separately authenticated WebSocket connections represented Noel, Alex, and an uninvited user. These are disposable test identities, not Google/email accounts.

Passed:

- Create a private stream and invite Alex using Noel's identity.
- Receive Noel's message live as Alex, with the correct author.
- Receive Alex's reply live as Noel.
- Resubmit the exact same signed message and confirm only one copy in stored history.
- Disconnect Alex, send a message, reconnect Alex, and recover every expected message from history.
- Verify the uninvited user receives no private-room history and cannot post there.
- Restart the isolated relay, Postgres, and Redis; verify both members recover every recorded message and the outsider still receives no history.

## Exact system tested

- Official image: `ghcr.io/block/buzz@sha256:496c38cc235db7cbbbe9706e67e5dfe9b14ba987d9fd309a8fe6b81d967151ce`
- Image source revision: `c045321a7fb3ca8939f28519ce7a555a6f597728`, matching the cloned backend checkout.
- PostgreSQL 17, Redis 7, MinIO, and the original relay image.
- Deployment adapted from `buzz/deploy/compose/compose.yml` with a separate Compose project, volumes, generated secrets, and loopback-only relay binding at `127.0.0.1:3030`.
- HTTP authentication enabled during tests; WebSocket NIP-42 authentication used by all clients.
- Relay-wide allowlisting disabled in this local test. Private-channel membership remains enforced. This does not test a closed production workspace's admission policy.
- Git conformance startup probe disabled because this test concerns messaging, not repository hosting.
- No production/native Buzz data, credentials, or volumes used. No messaging source changes required.

## Reproduce

From the parent project directory, with the isolated test stack running:

```sh
node outputs/messaging-smoke.cjs
docker compose -f work/backend-test/compose.yml restart relay postgres redis
node outputs/messaging-smoke.cjs --after-restart
```

Wait for the relay to finish restarting before the last command. The first command creates a fresh private room on each run. Test identity secrets and restart assertion IDs are in the local mode-0600 file `work/backend-test/identities.json`. Stack secrets are in `work/backend-test/.env`; do not publish either file.

## Boundaries and next step

This is a protocol-level integration test against the real backend, not a screenshot/UI test and not a load or crash-consistency certification. Restart was orderly, not a forced host failure. It does not test multiple relay replicas, unauthorized live fan-out, revoked membership, uploads, search, or agent job persistence.

The original Buzz UI is now connected to this backend through Buzz's existing real-relay browser test harness. Separate sessions at http://127.0.0.1:5174 (Noel) and http://127.0.0.1:5175 (Alex) offer a simple account picker. Browser testing verified messages in both directions, history after reloading Noel's session, and an Alex thread reply appearing in Noel's session. HTTP requests use signed NIP-98 authentication; the relay's authentication remains enabled.

This is local test authentication, not production account management. Disposable identity keys stay in browser memory and the local protected fixture file. The session endpoint rejects unrelated origins/hosts, and live-test mode cannot be built for deployment. Focused endpoint-boundary tests and desktop TypeScript checks pass. Other native and agent features still use the upstream harness's simulated responses. The existing port-5173 frontend remains the prior mock-backed preview. See `buzz/FRONTEND.md` for startup commands and scope.

Product direction: reuse Buzz's messaging frontend and backend, with internal identities hidden from users; add Co-founder features and Lovable integration through focused adapters. The earlier PRD's prohibition on the internal Nostr substrate is superseded by the user's subsequent instruction to reuse the existing backend. Own computer remains MVP 2.
