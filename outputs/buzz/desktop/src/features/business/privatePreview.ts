// Private Lovable preview hosts require a first-party browser session. The
// public MCP preview_url is not an authenticated iframe URL.
export function isPrivateLovablePreview(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      /^id-preview(?:--|-)[a-z0-9-]+\.lovable\.app$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}
