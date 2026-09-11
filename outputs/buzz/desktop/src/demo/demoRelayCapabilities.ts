/** Keep the original relay-dependent controls visible in the local preview. */
export function installDemoRelayCapabilities() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      window.location.href,
    );
    if (url.origin !== "http://localhost:3000")
      return originalFetch(input, init);
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (url.pathname === "/info") {
      return Response.json({
        supported_extensions: ["buzz-gif"],
        gif: { provider: "klipy", search: "/gif/search", share: "/gif/share" },
      });
    }
    if (url.pathname === "/gif/search" || url.pathname === "/gif/share") {
      return Response.json(
        { error: "Connect a workspace to search GIFs." },
        { status: 503 },
      );
    }
    return originalFetch(input, init);
  };
}
