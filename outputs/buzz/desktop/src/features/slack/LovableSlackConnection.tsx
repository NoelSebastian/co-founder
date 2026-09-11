import { useState } from "react";
import { ExternalLink, MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { slackApi, type SlackUser } from "./api";
import { isLovableUser, LOVABLE_SLACK_SETTINGS } from "./lovableIntegration";

export function LovableSlackConnection({
  connections,
}: {
  connections: any[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function open(connection: string) {
    setBusy(true);
    setError("");
    try {
      let cursor = "";
      const seen = new Set<string>();
      for (let page = 0; page < 100; page++) {
        const r = await slackApi("users", { connection, cursor });
        const user = (r.members as SlackUser[]).find(isLovableUser);
        if (user) {
          const dm = await slackApi("open", { connection, users: [user.id] });
          window.location.hash = `/slack?connection=${encodeURIComponent(connection)}&channel=${encodeURIComponent(dm.channel.id)}`;
          return;
        }
        cursor = r.response_metadata?.next_cursor || "";
        if (!cursor)
          throw new Error(
            "Lovable isn’t installed in this Slack workspace. Connect it in Lovable, then try again.",
          );
        if (seen.has(cursor)) break;
        seen.add(cursor);
      }
      throw new Error(
        "Slack’s directory could not be fully checked. Please retry.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-3 rounded-xl border p-4"
      aria-label="Lovable in Slack"
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <MessageSquare className="h-4 w-4" />
        Lovable
      </h2>
      <p className="text-sm text-muted-foreground">
        Create apps, edit any project you can access, and ask questions about
        its live data. Talk to the official Lovable agent in a DM or mention it
        in a channel.
      </p>
      <a
        href={LOVABLE_SLACK_SETTINGS}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 text-sm underline"
      >
        Connect or manage Lovable <ExternalLink className="h-3 w-3" />
      </a>
      {connections
        .filter((c) => c.status === "connected")
        .map((c) => (
          <div key={c.id}>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void open(c.id)}
            >
              {busy && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}Open
              Lovable in {c.team_name}
            </Button>
          </div>
        ))}
      <p className="text-xs text-muted-foreground">
        After connecting, return here and open Lovable. Your existing Lovable
        permissions and credits apply. Some approvals must be completed in Slack
        or Lovable.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
