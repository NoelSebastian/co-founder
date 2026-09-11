import { SlackCreateChannel } from "./SlackCreateChannel";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/ui/dropdown-menu";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Hash,
  Lock,
  Plus,
  Settings,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/shared/ui/sidebar";
import { slackApi, userName } from "./api";
export function SlackSidebar() {
  const [creating, setCreating] = useState(false);
  const [hiddenSections, setHiddenSections] = useState<string[]>([]);
  const [connections, setConnections] = useState<any[]>([]),
    [rows, setRows] = useState<any[]>([]),
    [collapsed, setCollapsed] = useState(false),
    [active, setActive] = useState(window.location.hash),
    [error, setError] = useState("");
  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const s = await slackApi("status");
        const all: any[] = [];
        for (const c of s.connections.filter(
          (c: any) => c.status === "connected",
        )) {
          const users: any = {};
          let cursor = "";
          do {
            const r = await slackApi("users", { connection: c.id, cursor });
            for (const u of r.members || []) users[u.id] = u;
            cursor = r.response_metadata?.next_cursor || "";
          } while (cursor);
          cursor = "";
          do {
            const r = await slackApi("conversations", {
              connection: c.id,
              cursor,
            });
            all.push(
              ...(r.channels || []).map((ch: any) => ({
                ...ch,
                connection: c.id,
                label: ch.is_im
                  ? users[ch.user]
                    ? userName(users[ch.user])
                    : ch.user
                  : ch.name,
              })),
            );
            cursor = r.response_metadata?.next_cursor || "";
          } while (cursor);
        }
        if (!stopped) {
          setConnections(s.connections);
          setRows(all);
          setError("");
        }
      } catch (e) {
        if (!stopped) setError("Slack connection unavailable");
      }
    }
    void load();
    const timer = setInterval(load, 60000);
    const changed = () => {
      setActive(window.location.hash);
      void load();
    };
    window.addEventListener("hashchange", changed);
    window.addEventListener("slack:conversations-changed", changed);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("hashchange", changed);
      window.removeEventListener("slack:conversations-changed", changed);
    };
  }, []);
  const go = (suffix = "") => {
    window.location.hash = "/slack" + suffix;
    window.dispatchEvent(new Event("hashchange"));
  };
  return (
    <section className="px-2 pb-3 pt-3" aria-label="Slack conversations">
      <div className="flex items-center px-2 pb-1 text-xs text-sidebar-foreground/60">
        <button
          className="flex flex-1 items-center gap-2 text-left"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
        >
          Slack{" "}
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
        <button
          className="p-1 hover:text-sidebar-foreground"
          aria-label="Slack connections"
          onClick={() => go("?setup=1")}
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
        <button
          className="p-1 hover:text-sidebar-foreground"
          aria-label="New Slack message"
          onClick={() => go("?new=1")}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {!collapsed && (
        <>
          {error && (
            <p className="px-2 text-xs text-muted-foreground">{error}</p>
          )}
          {!connections.length && (
            <SidebarMenuButton onClick={() => go()}>
              Connect Slack
            </SidebarMenuButton>
          )}
          {["Channels", "Direct messages"].map((section) => (
            <div key={section}>
              <div className="group flex items-center px-2 py-1 text-xs text-sidebar-foreground/70">
                <button
                  className="flex flex-1 items-center gap-1 text-left"
                  aria-expanded={!hiddenSections.includes(section)}
                  onClick={() =>
                    setHiddenSections((old) =>
                      old.includes(section)
                        ? old.filter((s) => s !== section)
                        : [...old, section],
                    )
                  }
                >
                  <ChevronDown
                    className={`size-3 ${hiddenSections.includes(section) ? "-rotate-90" : ""}`}
                  />
                  {section}
                </button>
                {section === "Channels" ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label="Add Slack channels"
                        title="Add channels"
                        className="rounded p-1 hover:bg-sidebar-accent"
                      >
                        <Plus className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onSelect={() => setCreating(true)}>
                        Create a new channel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <button
                    aria-label="Add Slack direct message"
                    title="New message"
                    className="rounded p-1 hover:bg-sidebar-accent"
                    onClick={() => go("?new=1")}
                  >
                    <Plus className="size-4" />
                  </button>
                )}
              </div>
              {!hiddenSections.includes(section) && (
                <SidebarMenu>
                  {rows
                    .filter(
                      (ch) =>
                        (section === "Direct messages") ===
                        !!(ch.is_im || ch.is_mpim),
                    )
                    .map((ch) => (
                      <SidebarMenuItem key={ch.connection + ch.id}>
                        <SidebarMenuButton
                          isActive={active.includes("channel=" + ch.id)}
                          onClick={() =>
                            go(
                              "?channel=" +
                                ch.id +
                                "&connection=" +
                                ch.connection,
                            )
                          }
                        >
                          {ch.is_im || ch.is_mpim ? (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sidebar-foreground/10 text-[10px]">
                              {ch.label?.slice(0, 1)}
                            </span>
                          ) : ch.is_private ? (
                            <Lock className="h-4 w-4" />
                          ) : (
                            <Hash className="h-4 w-4" />
                          )}
                          <span className="truncate">{ch.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              )}
            </div>
          ))}
        </>
      )}
      {creating && (
        <SlackCreateChannel
          connections={connections.filter((c) => c.status === "connected")}
          onClose={() => setCreating(false)}
        />
      )}
    </section>
  );
}
