import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Plug, RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { businessSections } from "./businessSections";
type Item = {
  id: string;
  subject: string;
  sender?: string;
  status: string;
  room: string;
  chat_thread: string | null;
};
type Intake = {
  items: Item[];
  gmail: { connected: boolean; lastChecked: string | null };
};
const labels: Record<string, string> = {
  needs_approval: "Awaiting approval",
  reply_ready: "Reply draft ready",
  building: "Building",
  testing: "Testing",
  received: "Received",
  tests_failed: "Tests failed",
  test_access_required: "Needs preview access",
};
export function BusinessPerformance({ section }: { section: string }) {
  const config = businessSections.find((s) => s.id === section);
  const [connections, setConnections] = useState(false),
    [data, setData] = useState<Intake | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [refresh, setRefresh] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset view controls when navigating between sections
  useEffect(() => {
    setQuery("");
    setFilter("all");
    setConnections(false);
  }, [section]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh is the explicit user retry trigger
  useEffect(() => {
    if (section !== "customer-support") return;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("http://127.0.0.1:5180/feedback", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (r) => {
        if (!r.ok)
          throw Error("Customer support could not be loaded. Try refreshing.");
        return r.json();
      })
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [section, refresh]);
  if (!config)
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <Link to="/business/$section" params={{ section: "revenue" }}>
          Open Revenue
        </Link>
      </div>
    );
  const support = section === "customer-support",
    live = support && data && !error;
  const counts = live
    ? [
        data.items.length,
        data.items.filter((x) => x.status === "needs_approval").length,
        data.items.filter((x) => x.status === "reply_ready").length,
      ]
    : null;
  const items =
    data?.items.filter(
      (x) =>
        (filter === "all" || x.status === filter) &&
        x.subject.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];
  const Icon = config.icon;
  return (
    <main
      className="flex min-h-0 flex-1 flex-col bg-background"
      data-testid="business-performance"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-muted-foreground" />
          {config.title}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setConnections(true)}>
          <Plug className="size-4" />
          Data sources
        </Button>
      </header>
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl space-y-7 p-6 lg:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                Business applications
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                {config.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {config.description}
              </p>
            </div>
            <span className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground">
              {support ? "All tracked requests" : "Awaiting data connection"}
            </span>
          </div>
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
            >
              {error}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRefresh((x) => x + 1)}
              >
                Retry
              </Button>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {config.metrics.map(([name, definition], i) => (
              <article
                key={name}
                className="rounded-lg border border-border p-5"
              >
                <h2 className="text-sm text-muted-foreground">{name}</h2>
                <p className="my-3 text-3xl font-semibold tabular-nums">
                  {counts ? counts[i] : "—"}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {definition}
                </p>
              </article>
            ))}
          </div>
          {!support && (
            <section className="flex flex-wrap items-center justify-between gap-5 rounded-lg border border-border bg-muted/25 p-6">
              <div className="max-w-xl">
                <h2 className="font-medium">
                  Bring your {config.source.toLowerCase()} into view
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  This page needs {config.provider}. Once connected, metrics and
                  the records behind them will appear here.
                </p>
              </div>
              <Button variant="outline" onClick={() => setConnections(true)}>
                <Plug className="size-4" />
                View data requirements
              </Button>
            </section>
          )}
          <section className="overflow-hidden rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <h2 className="text-sm font-semibold">{config.detail}</h2>
              {support && (
                <div className="flex flex-wrap gap-2">
                  <input
                    aria-label="Search customer requests"
                    placeholder="Search requests…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                  <select
                    aria-label="Filter requests"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="all">All statuses</option>
                    <option value="needs_approval">Awaiting approval</option>
                    <option value="reply_ready">Reply draft ready</option>
                  </select>
                  <Button
                    aria-label="Refresh customer support"
                    size="icon"
                    variant="ghost"
                    disabled={loading}
                    onClick={() => setRefresh((x) => x + 1)}
                  >
                    <RefreshCw
                      className={`size-4 ${loading ? "animate-spin" : ""}`}
                    />
                  </Button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/25 text-xs text-muted-foreground">
                  <tr>
                    {config.columns.map((c) => (
                      <th key={c} className="px-5 py-3 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {support &&
                    !error &&
                    items.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="max-w-sm px-5 py-4 font-medium">
                          {item.subject}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {item.sender || "Email sender"}
                        </td>
                        <td className="px-5 py-4">
                          <span className="whitespace-nowrap rounded-md bg-muted px-2 py-1 text-xs">
                            {labels[item.status] ||
                              item.status.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {item.chat_thread && (
                            <a
                              className="inline-flex items-center gap-1 whitespace-nowrap underline underline-offset-4"
                              href={`#/channels/${item.room}?thread=${item.chat_thread}`}
                            >
                              Open thread
                              <ArrowUpRight className="size-3" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  {(!support || !items.length || error) && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-12 text-center text-sm text-muted-foreground"
                      >
                        {support
                          ? loading
                            ? "Loading requests…"
                            : error
                              ? "Data unavailable"
                              : data
                                ? "No requests match this view."
                                : "Loading requests…"
                          : "Your connected records will appear here."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <p className="text-xs text-muted-foreground">
            {support
              ? `Source: Gmail customer feedback · ${data?.gmail.connected ? "Connected" : "Connection not verified"}${data?.gmail.lastChecked ? ` · Last checked ${new Date(data.gmail.lastChecked).toLocaleString()}` : ""}. Reply drafts are not counted as sent or closed tickets.`
              : `Source: ${config.provider} · Not connected. Missing values are shown as —, never zero.`}
          </p>
        </div>
      </div>
      <Dialog open={connections} onOpenChange={setConnections}>
        <DialogContent>
          <DialogTitle>{config.title} data sources</DialogTitle>
          <DialogDescription>
            {support
              ? "This view uses the existing Gmail customer feedback workflow."
              : `${config.provider} is not connected yet. This page is ready for data, but the connector still needs to be implemented and authorised.`}
          </DialogDescription>
          <div className="space-y-4 py-2">
            {config.metrics.map(([name, definition]) => (
              <div key={name}>
                <h3 className="text-sm font-medium">{name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {definition}
                </p>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={() => setConnections(false)}>
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
