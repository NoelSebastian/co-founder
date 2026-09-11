import { useState } from "react";
import { createRoot } from "react-dom/client";
import { finalizeEvent } from "nostr-tools";

type Session = {
  identity: { username: string; pubkey: string; privateKey: string };
  room: string;
};

function TestSignIn({ onSelect }: { onSelect: (session: Session) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function select(user: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/__cofounder-test/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user }),
      });
      const session = await response.json();
      if (!response.ok) throw new Error(session.error);
      sessionStorage.setItem("cofounder-test-user", user);
      onSelect(session);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }
  return (
    <main className="flex h-screen items-center justify-center bg-background text-foreground">
      <section className="w-80 space-y-5 rounded-xl border border-border bg-card p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Co-founder</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a local test account.
          </p>
        </div>
        {["Noel", "Alex"].map((name) => (
          <button
            key={name}
            type="button"
            disabled={busy}
            onClick={() => void select(name)}
            className="block w-full rounded-lg border border-border px-4 py-3 text-left text-sm hover:bg-accent disabled:opacity-50"
          >
            Continue as {name}
          </button>
        ))}
        <p className="text-xs text-muted-foreground">
          Real shared messages. Separate test identities. Local testing only.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

/** Activate Buzz's existing real-relay browser harness for local two-user testing. */
export async function configureLiveTest(): Promise<boolean> {
  if (!["127.0.0.1"].includes(location.hostname))
    throw new Error("Local test mode requires loopback");
  let session: Session;
  const selected = sessionStorage.getItem("cofounder-test-user");
  const response = selected
    ? await fetch("/__cofounder-test/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: selected }),
      })
    : null;
  if (response?.ok) session = await response.json();
  else {
    const rootElement = document.getElementById("root");
    if (!rootElement) throw new Error("Missing application root");
    const root = createRoot(rootElement);
    session = await new Promise<Session>((resolve) =>
      root.render(<TestSignIn onSelect={resolve} />),
    );
    root.unmount();
  }
  const { identity, room } = session;
  if (!/^[0-9a-f]{64}$/i.test(identity.privateKey))
    throw new Error("Invalid local test identity");
  const secret = Uint8Array.from({ length: 32 }, (_, index) =>
    Number.parseInt(identity.privateKey.slice(index * 2, index * 2 + 2), 16),
  );
  const relayUrl = "ws://127.0.0.1:3030";
  const relayHttp = "http://127.0.0.1:3030";
  const originalFetch = window.fetch.bind(window);
  // The upstream test harness uses X-Pubkey. Authenticate every real relay
  // HTTP request with NIP-98 instead; never weaken relay authorization.
  window.fetch = async (input, init) => {
    const request = new Request(input, init);
    if (
      ![relayHttp, "http://127.0.0.1:5180"].includes(
        new URL(request.url).origin,
      )
    )
      return originalFetch(request);
    const body = await request.clone().text();
    const tags = [
      ["u", request.url],
      ["method", request.method],
      ["nonce", crypto.randomUUID()],
    ];
    if (body) {
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(body),
      );
      tags.push([
        "payload",
        Array.from(new Uint8Array(hash), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
      ]);
    }
    const auth = finalizeEvent(
      {
        kind: 27235,
        created_at: Math.floor(Date.now() / 1000),
        content: "",
        tags,
      },
      secret,
    );
    const headers = new Headers(request.headers);
    headers.delete("X-Pubkey");
    headers.set("Authorization", `Nostr ${btoa(JSON.stringify(auth))}`);
    return originalFetch(new Request(request, { headers }));
  };
  const profile = finalizeEvent(
    {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      content: JSON.stringify({
        name: identity.username,
        display_name: identity.username,
      }),
      tags: [],
    },
    secret,
  );
  const publish = await fetch(`${relayHttp}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!publish.ok)
    throw new Error(`Profile initialization failed: ${publish.status}`);
  window.__BUZZ_E2E__ = {
    mode: "relay",
    relayHttpUrl: relayHttp,
    relayWsUrl: relayUrl,
    identity,
    mock: { managedAgents: [], teams: [], activePersonaIds: [] },
  };
  const communityId = "cofounder-local-live";
  localStorage.setItem(
    "buzz-communities",
    JSON.stringify([
      {
        id: communityId,
        name: "Co-founder",
        relayUrl,
        pubkey: identity.pubkey,
        addedAt: new Date().toISOString(),
      },
    ]),
  );
  localStorage.setItem("buzz-active-community-id", communityId);
  localStorage.setItem(
    `buzz-onboarding-complete.v1:${identity.pubkey}`,
    "true",
  );
  localStorage.setItem(
    `buzz-welcome-channel-ensured.v2:${encodeURIComponent(relayUrl)}:${identity.pubkey}`,
    "true",
  );
  document.title = `Co-founder — ${identity.username}`;
  if (!location.hash || location.hash === "#" || location.hash === "#/") {
    location.hash = `/channels/${room}`;
    location.reload();
    return false;
  }
  return true;
}
