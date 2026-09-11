# Buzz agent integration — 9 September 2026

The application uses Buzz's existing agent creation, definition editor, instance editor, profile, membership and message interfaces. The local web transport forwards agent commands to the authenticated workflow service. Agents run the pinned upstream Buzz Agent / buzz-acp container and use the upstream relay for messaging.

## Verified through the application

- Co-founder is listed, can start/stop, and replies after being added to a group DM.
- Adding Co-founder to Noel and Alex's DM creates a separate group; the original DM remains private. Both human clients received the reply.
- Research test was created and launched through Agents. Its instructions were edited through the existing Buzz editor. Its subsequent DM reply matched the new instruction exactly.
- Co-founder's own settings were edited and saved through its profile. Reloading preserved the new instructions.
- Meridian's connected-app panel uses a side-by-side chat. Measured iframe right edge equals panel left edge; neither overlays the other.
- A read-only request from that panel reached the existing Meridian project in Lovable and returned the actual project description. This was not an application-change or visual-regression test of Meridian.

## Configuration transport

Definitions and additional-agent records persist in PostgreSQL. Workspace defaults and the pre-existing Co-founder deployment overlay persist in private local files. Credential values are masked in responses; a masked value round-trips without replacing the actual credential. Reserved service/identity environment variables cannot be changed through the agent editor.

Create/update, access policy, model/provider, runtime arguments, tuning environment, lifecycle and logs have real service paths. OpenRouter models come from live discovery. Mention revalidation consults actual relay membership and the configured instruction policy. The browser cannot claim a successful unsupported save through the old mock handler for the intercepted commands.

The installed harness is Buzz Agent. This is not complete desktop feature parity: installing arbitrary harnesses, remote hosting, persona sharing, team/catalog/snapshot flows and agent memory management still require separate transport work. They must not be presented as tested or production-ready. No runtime-capability rules were changed; the existing Buzz contributor rules remain authoritative.

## Remaining operational limitations

- Configuration changes currently restart immediately rather than waiting for an active turn to finish. Avoid editing a busy agent until idle coordination is implemented.
- A Lovable edit is saved in Lovable; the embedded published app changes after publication. The chat does not independently test or automatically publish edits.
- The local services and credentials are single-workspace development infrastructure, not a multi-tenant production deployment.
