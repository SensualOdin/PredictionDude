"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  DollarSign,
  Target,
  Flame,
  CircleDot,
  Loader2,
  Radar,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatCST } from "@/lib/utils";

const POLL_INTERVAL = 30_000;

function formatDate(date: Date) {
  return formatCST(date, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatPnl(pnl: number) {
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}$${pnl.toFixed(2)}`;
}

function confidenceColor(confidence: number) {
  if (confidence >= 80) return "text-neon-cyan text-glow-cyan";
  if (confidence >= 60) return "text-neon-yellow";
  return "text-[#7a7a9a]";
}

export default function DashboardPage() {
  const today = new Date();
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json()),
    refetchInterval: POLL_INTERVAL,
  });

  const { data: betsData } = useQuery({
    queryKey: ["activeBets"],
    queryFn: () => fetch("/api/bets?status=open&limit=20").then((r) => r.json()),
    refetchInterval: POLL_INTERVAL,
  });

  const runScan = useMutation({
    mutationFn: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180_000);
      try {
        const res = await fetch("/api/cron/scan", {
          method: "POST",
          signal: controller.signal,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Scan failed");
        }
        return res.json();
      } finally {
        clearTimeout(timeout);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["activeBets"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success(
        `Scanned ${data.marketsScanned} markets, ${data.marketsQueued} queued for analysis`
      );
    },
    onError: (error: Error) => {
      if (error.name === "AbortError") {
        toast.error("Scan timed out -- try again or check results later");
        queryClient.invalidateQueries({ queryKey: ["activeBets"] });
      } else {
        toast.error(error.message);
      }
    },
  });

  const activeBets = betsData?.bets ?? [];

  const statCards = [
    {
      title: "Win Rate",
      value: stats?.winRate != null ? `${(stats.winRate * 100).toFixed(1)}%` : "\u2014%",
      description: stats?.totalResolved ? `${stats.totalResolved} resolved bets` : "No resolved bets",
      icon: TrendingUp,
      accent: stats?.winRate != null ? (stats.winRate >= 0.5 ? "text-neon-cyan" : "text-neon-magenta") : "text-[#5a5a7a]",
      iconBg: stats?.winRate != null ? (stats.winRate >= 0.5 ? "bg-neon-cyan/10" : "bg-neon-magenta/10") : "bg-[#1a1a4a]/50",
      glowClass: stats?.winRate != null && stats.winRate >= 0.5 ? "glow-cyan" : "",
    },
    {
      title: "Total P&L",
      value: stats?.totalPnl != null ? formatPnl(stats.totalPnl) : "$0.00",
      description: "Lifetime profit/loss",
      icon: DollarSign,
      accent: stats?.totalPnl > 0 ? "text-neon-cyan" : stats?.totalPnl < 0 ? "text-neon-magenta" : "text-[#5a5a7a]",
      iconBg: stats?.totalPnl > 0 ? "bg-neon-cyan/10" : stats?.totalPnl < 0 ? "bg-neon-magenta/10" : "bg-[#1a1a4a]/50",
      glowClass: stats?.totalPnl > 0 ? "glow-cyan" : stats?.totalPnl < 0 ? "glow-magenta" : "",
    },
    {
      title: "Active Bets",
      value: String(stats?.activeCount ?? 0),
      description: "Open positions",
      icon: Target,
      accent: stats?.activeCount > 0 ? "text-neon-purple" : "text-[#5a5a7a]",
      iconBg: stats?.activeCount > 0 ? "bg-neon-purple/10" : "bg-[#1a1a4a]/50",
      glowClass: "",
    },
    {
      title: "Bankroll",
      value: stats?.currentBankroll != null ? `$${Number(stats.currentBankroll).toFixed(2)}` : "$1,000.00",
      description: stats?.startingBankroll ? `Started at $${Number(stats.startingBankroll).toFixed(2)}` : "Paper trading",
      icon: Flame,
      accent: (stats?.currentBankroll ?? 1000) >= (stats?.startingBankroll ?? 1000) ? "text-neon-cyan" : "text-neon-magenta",
      iconBg: (stats?.currentBankroll ?? 1000) >= (stats?.startingBankroll ?? 1000) ? "bg-neon-cyan/10" : "bg-neon-magenta/10",
      glowClass: (stats?.currentBankroll ?? 1000) >= (stats?.startingBankroll ?? 1000) ? "glow-cyan" : "glow-magenta",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neon-cyan text-glow-cyan uppercase">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[#7a7a9a]">{formatDate(today)}</p>
        </div>
        <Button
          onClick={() => runScan.mutate()}
          disabled={runScan.isPending}
          className="btn-neon-cyan font-semibold min-h-[44px] uppercase tracking-wider text-sm"
        >
          {runScan.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Radar className="mr-2 h-4 w-4" />
              Scan Now
            </>
          )}
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className={`cyber-card neon-border-pulse ${stat.glowClass}`}>
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardDescription className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.15em] text-[#7a7a9a]">
                  {stat.title}
                </CardDescription>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.iconBg}`}>
                  <Icon className={`h-4 w-4 ${stat.accent}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-xl sm:text-2xl font-bold ${stat.accent}`}>{stat.value}</div>
                <p className="mt-1 text-[10px] sm:text-xs text-[#5a5a7a]">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Active Positions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neon-cyan uppercase tracking-wider">Active Positions</h2>
            <p className="text-sm text-[#7a7a9a]">Open bets with AI insights</p>
          </div>
          <Badge variant="outline" className="border-neon-cyan/30 text-neon-cyan/70 tracking-wider uppercase text-[10px]">
            {activeBets.length} position{activeBets.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {activeBets.length === 0 ? (
          <Card className="cyber-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1a1a4a]/60">
                <CircleDot className="h-6 w-6 text-[#5a5a7a]" />
              </div>
              <p className="mt-4 text-center text-sm text-[#7a7a9a] max-w-sm">
                No active positions. Hit &ldquo;Scan Now&rdquo; to find opportunities.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {activeBets.map((bet: Record<string, unknown>) => {
              const confidence = bet.confidence as number | null;
              const reasoning = bet.reasoning as string | null;
              const keyRisk = bet.keyRisk as string | null;

              return (
                <Card key={bet.id as string} className="cyber-card overflow-hidden">
                  <CardContent className="flex flex-col gap-3 py-3 sm:py-4">
                    {/* Top row: badge + title + confidence */}
                    <div className="flex items-start gap-3">
                      <Badge className={bet.side === "yes"
                        ? "bg-neon-cyan/15 text-neon-cyan border-neon-cyan/30 font-bold tracking-wider shrink-0"
                        : "bg-neon-magenta/15 text-neon-magenta border-neon-magenta/30 font-bold tracking-wider shrink-0"
                      }>
                        {(bet.side as string)?.toUpperCase()}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#e0e0f0] truncate">
                          {(bet.marketTitle ?? bet.marketTicker) as string}
                        </p>
                        <p className="text-xs text-[#5a5a7a] mt-0.5">
                          {bet.contracts as number} contracts @ ${Number(bet.entryPrice).toFixed(2)} &middot; ${Number(bet.totalCost ?? 0).toFixed(2)} at risk &middot; {bet.mode as string}
                        </p>
                      </div>
                      {confidence != null && (
                        <div className="text-right shrink-0">
                          <p className={cn("text-sm font-semibold", confidenceColor(confidence))}>
                            {confidence}%
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-[#5a5a7a]">confidence</p>
                        </div>
                      )}
                    </div>

                    {/* AI reasoning + risk */}
                    {(reasoning || keyRisk) && (
                      <div className="pl-0 sm:pl-14 space-y-1">
                        {reasoning && (
                          <p className="text-xs text-[#7a7a9a] line-clamp-2">{reasoning}</p>
                        )}
                        {keyRisk && (
                          <p className="text-xs text-neon-magenta/70 line-clamp-1">
                            Risk: {keyRisk}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
