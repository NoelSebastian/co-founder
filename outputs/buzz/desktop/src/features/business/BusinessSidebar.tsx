import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Plus, AppWindow, MoreHorizontal } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from "@/shared/ui/sidebar";
import { businessApi, pagesChanged, type BusinessPage } from "./businessApi";
import { AddBusinessPage } from "./AddBusinessPage";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/ui/dropdown-menu";
import { toast } from "sonner";
export function BusinessSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [pages, setPages] = useState<BusinessPage[]>([]),
    [open, setOpen] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      businessApi("pages")
        .then((d) => {
          if (active) {
            setPages(d.pages);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    void load();
    window.addEventListener("business:changed", load);
    return () => {
      active = false;
      window.removeEventListener("business:changed", load);
    };
  }, []);
  const navigate = useNavigate();
  async function removePage(id: string, title: string) {
    try {
      await businessApi("remove", { id });
      pagesChanged();
      if (pathname === `/business/${id}`) void navigate({ to: "/" });
      toast.success(`${title} removed from sidebar`, {
        action: {
          label: "Undo",
          onClick: () => {
            void businessApi("restore", { id })
              .then(pagesChanged)
              .catch((e) => toast.error(e.message));
          },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove page");
    }
  }
  const pathname = useLocation({ select: (l) => l.pathname });
  return (
    <>
      <SidebarGroup>
        <SidebarMenu>
          {" "}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/business/lovable"}
              tooltip="Lovable"
            >
              <Link to="/business/$section" params={{ section: "lovable" }}>
                <img
                  src="https://lovable.dev/favicon.svg"
                  alt=""
                  className="size-4"
                />
                <span>Lovable</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      <SidebarGroup className="group/sidebar-section select-none">
        <SidebarGroupLabel asChild>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-controls="sidebar-business-performance"
            className="group/section-label flex w-fit max-w-[calc(100%-3rem)] cursor-pointer appearance-none items-center gap-1 text-left transition-colors hover:text-sidebar-foreground focus-visible:text-sidebar-foreground"
          >
            <span data-sidebar-section-title>Business applications</span>
            <span
              aria-hidden="true"
              className="relative size-2.5 shrink-0 text-current opacity-0 transition-[color,opacity] group-hover/sidebar-section:opacity-100 group-hover/section-label:opacity-100 group-focus-within/sidebar-section:opacity-100 group-focus-visible/section-label:opacity-100"
            >
              <ChevronDown
                className={`absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 ${collapsed ? "-rotate-90" : "rotate-0"}`}
              />
            </span>
          </button>
        </SidebarGroupLabel>
        {!collapsed && (
          <SidebarGroupContent id="sidebar-business-performance">
            <SidebarMenu>
              {pages.map(({ id, title }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === `/business/${id}`}
                    tooltip={title}
                  >
                    <Link to="/business/$section" params={{ section: id }}>
                      <AppWindow className="size-4" />
                      <span>{title}</span>
                    </Link>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction
                        showOnHover
                        aria-label={`More actions for ${title}`}
                      >
                        <MoreHorizontal />
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem
                        onSelect={() => void removePage(id, title)}
                      >
                        Remove from sidebar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setOpen(true)}>
                  <Plus className="size-4" />
                  <span>Add page</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            {error && (
              <p role="alert" className="p-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </SidebarGroupContent>
        )}
        <AddBusinessPage open={open} onOpenChange={setOpen} />
      </SidebarGroup>
    </>
  );
}
