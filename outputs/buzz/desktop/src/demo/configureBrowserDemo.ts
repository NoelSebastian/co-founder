import { AGENTS, SELF, WELCOME } from "./referenceWorkspace";
import { installDemoRelayCapabilities } from "./demoRelayCapabilities";

/** Start the original Buzz UI with a local, simulated desktop backend. */
export function configureBrowserDemo() {
  installDemoRelayCapabilities();
  const pubkey = "deadbeef".repeat(8);
  const communityId = "buzz-browser-demo";
  const relayUrl = "ws://localhost:3000";

  window.__BUZZ_E2E__ = {
    mode: "mock",
    mock: {
      relayRequiresMembership: true,
      relayRole: "owner",
      searchProfiles: [
        { pubkey: SELF, displayName: "Noel", isAgent: false },
        ...AGENTS.map((agent) => ({
          pubkey: agent.pubkey,
          displayName: agent.name,
          avatarUrl: agent.avatarUrl,
          ownerPubkey: SELF,
          isAgent: true,
        })),
      ],
      managedAgents: AGENTS.map((agent) => ({
        ...agent,
        status: "running" as const,
        channelIds: [WELCOME],
      })),
      activePersonaIds: AGENTS.map((agent) => agent.personaId),
      teams: [
        {
          id: "welcome-team",
          name: "Welcome Team",
          description: "Your welcome team",
          personaIds: AGENTS.map((agent) => agent.personaId),
        },
      ],
    },
  };
  const storage = window.localStorage;
  storage.setItem(
    "buzz-communities",
    JSON.stringify([
      {
        id: communityId,
        name: "lovable",
        relayUrl,
        pubkey,
        addedAt: "2026-09-09T00:00:00.000Z",
      },
    ]),
  );
  storage.setItem("buzz-active-community-id", communityId);
  storage.setItem(`buzz-onboarding-complete.v1:${pubkey}`, "true");
  storage.setItem(
    `buzz-welcome-channel-ensured.v2:${encodeURIComponent(relayUrl)}:${pubkey}`,
    "true",
  );
  if (!storage.getItem("buzz-theme")) storage.setItem("buzz-theme", "buzz");

  const firstReferenceVisit = !storage.getItem("buzz-reference-workspace.v2");
  if (firstReferenceVisit) {
    storage.setItem("buzz-reference-workspace.v2", "true");
    storage.setItem("buzz-theme", "buzz");
    storage.setItem("buzz-follow-system", "true");
    storage.setItem("buzz-glass-background", "false");
    storage.setItem("buzz.appearance.fontSize", "default");
    storage.setItem("buzz.appearance.conversationDensity", "comfortable");
    storage.setItem("buzz-sidebar-width", "300");
    storage.removeItem("buzz:text-scale");
  }

  // Land in a populated conversation; retain direct links to other screens.
  if (
    firstReferenceVisit ||
    !window.location.hash ||
    window.location.hash === "#/"
  ) {
    // Reload once so Buzz's hash router sees the initial route at import time.
    window.history.replaceState(null, "", `/#/channels/${WELCOME}`);
    window.location.reload();
    return false;
  }
  document.title = "Buzz — lovable (local preview)";
  return true;
}
