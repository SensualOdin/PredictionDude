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
          "group/sidebar fixed left-0 top-0 z-40 hidden h-screen w-16 flex-col border-r border-zinc-800/60 bg-zinc-950 transition-all duration-300 ease-in-out hover:w-60 md:flex"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center border-b border-zinc-800/60 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <span className="truncate text-sm font-semibold tracking-tight text-white opacity-0 transition-opacity duration-300 group-hover/sidebar:opacity-100">
              Kalshi AI Trader
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
                      "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0",
                        isActive ? "text-emerald-400" : "text-zinc-500"
                      )}
                    />
                    <span className="truncate opacity-0 transition-opacity duration-300 group-hover/sidebar:opacity-100">
                      {item.label}
                    </span>
                    {isActive && (
                      <div className="absolute left-0 h-6 w-0.5 rounded-r-full bg-emerald-400" />
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="group-hover/sidebar:hidden"
                >
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Mode Indicator */}
        <div className="flex items-center gap-3 border-t border-zinc-800/60 px-4 py-4">
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-[10px] uppercase tracking-wider",
              isRealMode
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-400"
            )}
          >
            {isRealMode ? "Real" : "Paper"}
          </Badge>
          <span className="truncate text-xs text-zinc-500 opacity-0 transition-opacity duration-300 group-hover/sidebar:opacity-100">
            {isRealMode ? "Real Trading" : "Paper Trading"}
          </span>
        </div>
      </aside>
    </TooltipProvider>
  );
}
