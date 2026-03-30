import { LayoutDashboard, Receipt, CreditCard, Target, Bot, CalendarDays, PiggyBank } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useHealth } from "@/context/HealthContext";

const navItems = [
  { title: "Dashboard",    url: "/",              icon: LayoutDashboard },
  { title: "Transactions", url: "/transactions",  icon: Receipt },
  { title: "Savings",      url: "/savings",       icon: PiggyBank },
  { title: "Debt Planner", url: "/debt-planner",  icon: CreditCard },
  { title: "Goals",        url: "/goals",         icon: Target },
  { title: "Calendar",     url: "/calendar",      icon: CalendarDays },
  { title: "AI Advisor",   url: "/ai-advisor",    icon: Bot },
];

const statusConfig = {
  checking: { dot: "🟡", label: "Checking...",     bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
  online:   { dot: "🟢", label: "Systems Live",   bg: "#dcfce7", color: "#166534", border: "#86efac" },
  offline:  { dot: "🔴", label: "Backend Offline", bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { status, recheck } = useHealth();
  const cfg = statusConfig[status];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-6">
        {/* Logo */}
        <div className="px-4 pb-4 mb-2 border-b border-sidebar-border">
          {collapsed ? (
            <span className="text-xl">💼</span>
          ) : (
            <h1 className="font-display text-xl font-bold text-sidebar-primary tracking-tight">
              FinSage 💼
            </h1>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Health Status Pill */}
      <SidebarFooter className="pb-4 px-3">
        <button
          id="health-status-pill"
          onClick={recheck}
          title="Click to recheck backend status"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: "6px",
            width: "100%",
            padding: collapsed ? "6px" : "6px 10px",
            borderRadius: "999px",
            background: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.border}`,
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 0.15s",
            lineHeight: 1.2,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <span style={{ fontSize: "12px", flexShrink: 0 }}>{cfg.dot}</span>
          {!collapsed && <span>{cfg.label}</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
