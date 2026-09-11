import { useState } from "react";
import { ArrowUpRight, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/shared/ui/button";

const pipelineUrl =
  "https://id-preview--3aa831e2-c372-4898-85b1-4e72929a4682.lovable.app/pipeline";

/** Display the existing CRM with its own session and access controls. */
export function MeridianPipeline() {
  const [revision, setRevision] = useState(0);
  const [help, setHelp] = useState(false);
  return (
    <main
      className="flex min-h-0 flex-1 flex-col bg-background"
      data-testid="meridian-pipeline"
    >
      <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-6 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="size-4 text-muted-foreground" />
          Sales pipeline
          <span className="ml-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            Meridian CRM
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHelp(!help)}
            aria-expanded={help}
          >
            Connection details
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reload Meridian"
            onClick={() => setRevision((x) => x + 1)}
          >
            <RefreshCw className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={pipelineUrl} target="_blank" rel="noreferrer">
              Open separately
              <ArrowUpRight className="size-4" />
            </a>
          </Button>
        </div>
      </header>
      {help && (
        <div className="shrink-0 border-b border-border bg-muted/25 px-6 py-4 text-sm text-muted-foreground">
          <p>
            This is your existing Meridian app. Changes you make here are saved
            in Meridian.
          </p>
          <p className="mt-2">
            Use “Sign in” if Meridian asks you to create a workspace. If sign-in
            is blocked inside this view, open it separately, sign in, then
            reload here.
          </p>
          <p className="mt-2">
            Meridian includes seeded example data. Its figures are not yet
            synced into other Business applications pages.
          </p>
        </div>
      )}
      <iframe
        key={revision}
        title="Meridian CRM sales pipeline"
        src={pipelineUrl}
        className="min-h-0 w-full flex-1 border-0 bg-background"
        allow="clipboard-write"
      />
    </main>
  );
}
