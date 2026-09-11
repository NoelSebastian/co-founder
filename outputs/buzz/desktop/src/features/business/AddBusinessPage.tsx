import { useEffect, useState } from "react";
import { PanelsTopLeft, Plus, Plug, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { businessApi, pagesChanged } from "./businessApi";
const choices = [
  {
    id: "lovable",
    title: "Connect existing Lovable application",
    description: "Choose a project and use it right here.",
    icon: PanelsTopLeft,
  },
  {
    id: "build",
    title: "Build a Lovable application from scratch",
    description: "Describe your idea and build it with Lovable.",
    icon: Plus,
  },
  {
    id: "connector",
    title: "Connect third-party application through a connector",
    description: "Connect your tools, then build a bespoke app with an agent.",
    icon: Plug,
  },
];
export function AddBusinessPage({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [mode, setMode] = useState(""),
    [title, setTitle] = useState(""),
    [project, setProject] = useState(""),
    [projects, setProjects] = useState<{ id: string; title: string }[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open) {
      setMode("");
      setTitle("");
      setProject("");
      setError("");
    }
  }, [open]);
  useEffect(() => {
    if (mode !== "lovable") return;
    let active = true;
    setBusy(true);
    businessApi("projects")
      .then((r) => {
        if (active) setProjects(r.projects);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [mode]);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogTitle>
          {mode
            ? choices.find((x) => x.id === mode)?.title
            : "Add a business page"}
        </DialogTitle>
        <DialogDescription>
          {mode === "lovable"
            ? "The application will appear inside your new page, using its existing login and permissions."
            : mode === "connector"
              ? "First connect a data source. Then work with Co-founder to build an app around it."
              : mode === "build"
                ? "Open a Lovable chat with a live app preview."
                : "How would you like to create this space?"}
        </DialogDescription>
        {!mode ? (
          <div className="space-y-3">
            {choices.map(({ id, title, description, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent"
              >
                <Icon
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
                <span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const r = await businessApi("create", {
                  title,
                  mode,
                  projectId: project,
                });
                pagesChanged();
                onOpenChange(false);
                window.location.hash = `/business/${r.id}`;
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not create page",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {mode === "lovable" && (
              <label className="block space-y-2 text-sm">
                <span>Lovable application</span>
                <select
                  aria-label="Lovable application"
                  required
                  className="w-full rounded-md border border-input bg-background p-2"
                  disabled={busy}
                  value={project}
                  onChange={(e) => {
                    setProject(e.target.value);
                    if (!title)
                      setTitle(
                        projects.find((p) => p.id === e.target.value)?.title ||
                          "",
                      );
                  }}
                >
                  <option value="">
                    {busy ? "Loading projects…" : "Choose a project"}
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block space-y-2 text-sm">
              <span>Page name</span>
              <input
                aria-label="Page name"
                required
                maxLength={80}
                className="w-full rounded-md border border-input bg-background p-2"
                placeholder="e.g. Sales pipeline"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-between">
              <Button
                variant="ghost"
                type="button"
                disabled={busy}
                onClick={() => {
                  setMode("");
                  setError("");
                }}
              >
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button
                disabled={
                  busy || !title.trim() || (mode === "lovable" && !project)
                }
                type="submit"
              >
                {busy
                  ? "Connecting…"
                  : mode === "lovable"
                    ? "Connect application"
                    : mode === "connector"
                      ? "Choose connector"
                      : "Start conversation"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
