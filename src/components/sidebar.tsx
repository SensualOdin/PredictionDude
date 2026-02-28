"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  TrendingUp,
  Target,
  BarChart3,
  Brain,
  Settings,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Markets", icon: TrendingUp, href: "/markets" },
  { label: "Bets", icon: Target, href: "/bets" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Strategy", icon: Brain, href: "/strategy" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
    refetchInterval: 60_000,
  });
  const tradingMode = (settingsData?.tradingMode as string) ?? "paper";

  const isRealMode = tradingMode === "real";

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "group/sidebar fixed left-0 top-0 z-40 hidden h-screen w-16 flex-col border-r border-neon-cyan/10 bg-cyber-bg/95 backdrop-blur-sm transition-all duration-300 ease-in-out hover:w-60 md:flex"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center border-b border-neon-cyan/10 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neon-cyan/10 text-neon-cyan glow-cyan">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <span className="truncate text-sm font-bold tracking-wider uppercase text-neon-cyan text-glow-cyan opacity-0 transition-opacity duration-300 group-hover/sidebar:opacity-100">
              PredictionDude
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
          {navItems.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all duration-200 relative",
                      isActive
                        ? "bg-neon-cyan/10 text-neon-cyan nav-active-glow"
                        : "text-[#7a7a9a] hover:bg-[#1a1a4a]/60 hover:text-[#c0c0d0]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0",
                        isActive ? "text-neon-cyan" : "text-[#5a5a7a]"
                      )}
                    />
                    <span className="truncate uppercase tracking-wider text-xs opacity-0 transition-opacity duration-300 group-hover/sidebar:opacity-100">
                      {item.label}
                    </span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="group-hover/sidebar:hidden border-neon-cyan/20 bg-cyber-card text-neon-cyan"
                >
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Mode Indicator */}
        <div className="flex items-center gap-3 border-t border-neon-cyan/10 px-4 py-4">
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-[10px] uppercase tracking-[0.15em] font-bold",
              isRealMode
                ? "border-neon-magenta/40 bg-neon-magenta/10 text-neon-magenta"
                : "border-neon-yellow/40 bg-neon-yellow/10 text-neon-yellow"
            )}
          >
            {isRealMode ? "Real" : "Paper"}
          </Badge>
          <span className="truncate text-xs text-[#5a5a7a] uppercase tracking-wider opacity-0 transition-opacity duration-300 group-hover/sidebar:opacity-100">
            {isRealMode ? "Real Trading" : "Paper Trading"}
          </span>
        </div>
      </aside>
    </TooltipProvider>
  );
}
