"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Target,
  BarChart3,
  Brain,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", icon: LayoutDashboard, href: "/" },
  { label: "Markets", icon: TrendingUp, href: "/markets" },
  { label: "Bets", icon: Target, href: "/bets" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Strategy", icon: Brain, href: "/strategy" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-neon-cyan/10 bg-cyber-bg/95 backdrop-blur-sm md:hidden">
      {navItems.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-w-[3rem] transition-colors duration-200",
              isActive ? "text-neon-cyan" : "text-[#5a5a7a]"
            )}
          >
            <Icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_rgba(0,240,255,0.5)]")} />
            <span className={cn(
              "text-[10px] leading-tight uppercase tracking-wider",
              isActive && "text-glow-cyan"
            )}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
