import { useRef, useState } from "react";
import { Hash, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { slackApi } from "./api";

export function SlackCreateChannel({
  connections,
  onClose,
}: {
  connections: any[];
  onClose: () => void;
}) {
  const [connection, setConnection] = useState(connections[0]?.id || "");
  const [name, setName] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const request = useRef(crypto.randomUUID());
  const inFlight = useRef(false);
  async function create() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const op = await slackApi("action", {
        connection,
        id: request.current,
        kind: "create-channel",
        payload: { name, is_private: isPrivate },
      });
      if (op.status !== "delivered") {
        if (op.status === "failed") request.current = crypto.randomUUID();
        else setUncertain(true);
        throw Error(
          op.error ||
            "Slack has not confirmed creation yet. Check your channel list before trying again.",
        );
      }
      window.location.hash = `/slack?channel=${op.result.channel.id}&connection=${connection}`;
      window.dispatchEvent(new Event("slack:conversations-changed"));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Create a channel" : "Choose visibility"}
          </DialogTitle>
          <DialogDescription>
            Channels are where your team communicates. They’re best when
            organized around a topic.
          </DialogDescription>
        </DialogHeader>
        {step === 1 ? (
          <div className="space-y-4">
            {connections.length > 1 && (
              <label className="block text-sm font-medium">
                Workspace
                <select
                  className="mt-2 w-full rounded border bg-background p-2"
                  value={connection}
                  onChange={(e) => setConnection(e.target.value)}
                >
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.team_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm font-semibold">
              Name
              <div className="mt-2 flex items-center gap-2 rounded border px-3 focus-within:ring-2 focus-within:ring-primary">
                <Hash className="size-4 text-muted-foreground" />
                <input
                  autoFocus
                  aria-label="Channel name"
                  maxLength={80}
                  className="w-full bg-transparent py-2 outline-none"
                  placeholder="e.g. plan-budget"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toLowerCase().replace(/\s/g, "-"))
                  }
                />
              </div>
            </label>
            <p className="text-xs text-muted-foreground">
              Use lowercase letters, numbers, hyphens and underscores.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {[false, true].map((privateOption) => (
              <label
                key={String(privateOption)}
                className="flex cursor-pointer items-start gap-3 rounded border p-4"
              >
                <input
                  type="radio"
                  name="visibility"
                  disabled={busy || uncertain}
                  checked={isPrivate === privateOption}
                  onChange={() => setPrivate(privateOption)}
                />
                <span className="space-y-1">
                  <span className="flex items-center gap-2 font-semibold">
                    {privateOption ? (
                      <Lock className="size-4" />
                    ) : (
                      <Hash className="size-4" />
                    )}
                    {privateOption ? "Private" : "Public"}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {privateOption
                      ? "Only invited people can find and join this channel."
                      : "Anyone in your workspace can find and join this channel."}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          {step === 2 && (
            <Button
              variant="ghost"
              disabled={busy || uncertain}
              onClick={() => setStep(1)}
            >
              Back
            </Button>
          )}
          <Button
            className="bg-[#007a5a] text-white hover:bg-[#148567]"
            disabled={
              busy ||
              uncertain ||
              !connection ||
              !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(name)
            }
            onClick={() => (step === 1 ? setStep(2) : void create())}
          >
            {step === 1 ? "Next" : busy ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
