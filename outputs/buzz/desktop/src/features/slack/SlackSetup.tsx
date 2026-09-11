import { useState } from "react";
import { Hash, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { slackApi } from "./api";
import { LovableSlackConnection } from "./LovableSlackConnection";
export function SlackSetup({
  status,
  onChanged,
}: {
  status: any;
  onChanged: () => void;
}) {
  const [advanced, setAdvanced] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [form, setForm] = useState({
    clientId: "",
    clientSecret: "",
    appToken: "",
    redirectUri: status.redirectUri || "",
  });
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const r = await slackApi("connect", {});
      window.location.assign(r.url);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await slackApi("configure", form);
      onChanged();
      setAdvanced(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function downloadManifest() {
    try {
      const data = await slackApi("manifest", {
        redirectUri: form.redirectUri || undefined,
      });
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "cofounder-slack-manifest.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <div className="flex h-full overflow-auto items-start justify-center p-8">
      <div className="w-full max-w-xl space-y-6 py-8">
        <Hash className="h-9 w-9" />
        <div>
          <h1 className="text-xl font-semibold">
            Your Slack, inside Co-founder
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect your account to browse channels, send messages, and keep up
            with your team. Your native chat stays separate.
          </p>
        </div>
        <div className="rounded-xl border p-4 text-sm space-y-2">
          <p className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4" />
            You stay you
          </p>
          <p>
            Messages are sent under your Slack identity. Slack remains the
            source of truth. Messaging works without an agent running.
          </p>
        </div>
        {status.configured ? (
          <Button onClick={connect} disabled={busy}>
            Connect Slack account <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <p className="text-sm">
            The workspace owner needs to configure the Slack application once
            before accounts can connect.
          </p>
        )}
        <LovableSlackConnection connections={status.connections || []} />
        {status.canConfigure && (
          <Button variant="ghost" onClick={() => setAdvanced(!advanced)}>
            {status.configured
              ? "Application settings"
              : "Set up Slack application"}
          </Button>
        )}
        {advanced && (
          <div className="space-y-4 rounded-xl border p-5">
            <h2 className="font-medium">Internal Slack application setup</h2>
            <p className="text-sm text-muted-foreground">
              Create an app from the manifest in Slack, enable Socket Mode, and
              generate an app-level token with connections:write. Use an HTTPS
              tunnel to the callback-only service on port 5191.
            </p>
            <a
              className="text-sm underline"
              href="https://api.slack.com/apps"
              target="_blank"
              rel="noreferrer"
            >
              Open Slack application settings
            </a>
            {(
              ["redirectUri", "clientId", "clientSecret", "appToken"] as const
            ).map((key) => (
              <label className="block text-sm" key={key}>
                {
                  {
                    redirectUri: "HTTPS callback URL",
                    clientId: "Client ID",
                    clientSecret: "Client secret",
                    appToken: "Socket Mode app token",
                  }[key]
                }
                <input
                  className="mt-1 w-full rounded-md border bg-background p-2"
                  type={
                    key === "clientSecret" || key === "appToken"
                      ? "password"
                      : "text"
                  }
                  autoComplete="off"
                  value={form[key]}
                  placeholder={
                    key === "redirectUri"
                      ? "https://your-host/slack/callback"
                      : status.configured
                        ? "Leave blank to keep saved value"
                        : ""
                  }
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadManifest}>
                Download app manifest
              </Button>
              <Button disabled={busy} onClick={save}>
                Save configuration
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Credentials are encrypted on the backend and are never sent to
              agents.
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Slack may require your workspace administrator to approve access.
          Huddles and interactive app controls open in Slack.
        </p>
      </div>
    </div>
  );
}
