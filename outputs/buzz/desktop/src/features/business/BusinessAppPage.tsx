import { isPrivateLovablePreview } from "./privatePreview";
import { LovablePageChat } from "./LovablePageChat";
import { useEffect, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { DrawerPanelIcon } from "@/shared/ui/DrawerPanelIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { Button } from "@/shared/ui/button";
import { businessApi, type BusinessPage } from "./businessApi";
export function BusinessAppPage({ id }: { id: string }) {
  const [page, setPage] = useState<BusinessPage | null>(null),
    [error, setError] = useState(""),
    [setup, setSetup] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setPage(null);
    setSetup(false);
    setError("");
    businessApi("pages")
      .then((d) => {
        if (active) {
          const p = d.pages.find((p: BusinessPage) => p.id === id);
          if (!p) throw Error("Page not found");
          setPage(p);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-2">
        <h1 className="text-sm font-medium">
          {page?.title || "Business applications"}
        </h1>
        <div className="flex items-center gap-1">
          {page?.url && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Reload app"
                onClick={() => setRevision((x) => x + 1)}
              >
                <RefreshCw className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href={page.url} target="_blank" rel="noreferrer">
                  Open separately
                  <ArrowUpRight className="size-4" />
                </a>
              </Button>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="Toggle Lovable panel"
                aria-expanded={setup}
                aria-controls="business-cofounder-panel"
                className="h-[28px] w-[28px] rounded-[4px] text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() => setSetup((open) => !open)}
              >
                <DrawerPanelIcon
                  side={setup ? "left" : "right"}
                  className="-scale-x-100"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {setup ? "Hide Lovable panel" : "Show Lovable panel"}
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="border-b border-border p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {setup && page && (
          <div
            className={`min-h-0 shrink-0 border-r ${page.url ? "w-[min(26rem,45%)]" : "w-[min(30rem,55%)]"}`}
          >
            <LovablePageChat key={page.id} page={page} onChange={setPage} />
          </div>
        )}
        {page?.url && isPrivateLovablePreview(page.url) ? (
          <section
            aria-label="Private app preview"
            className="flex min-w-0 flex-1 items-center justify-center bg-muted/20 p-8"
          >
            <div className="max-w-sm text-center">
              <h2 className="text-lg font-semibold">Your private app</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Keep building in the chat. Lovable currently requires its own
                browser session to view private previews.
              </p>
              <Button className="mt-5" asChild>
                <a
                  href={
                    page.project_id
                      ? `https://lovable.dev/projects/${page.project_id}`
                      : page.url
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Lovable
                  <ArrowUpRight className="size-4" />
                </a>
              </Button>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Opens the build and preview together. Your app remains private.
              </p>
            </div>
          </section>
        ) : page?.url ? (
          <iframe
            key={revision}
            title={`${page.title} app`}
            src={page.url}
            className="h-full min-w-0 flex-1 border-0 bg-background"
            allow="clipboard-write"
          />
        ) : (
          <div className="flex min-w-0 flex-1 items-center justify-center bg-muted/20 p-8">
            <div className="max-w-xs text-center">
              <h2 className="text-lg font-medium">Your app starts here</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Build with Lovable in the chat. When your app is ready, open its
                preview here.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
