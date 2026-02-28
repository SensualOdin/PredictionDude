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
  Inbox,
  CircleDot,
  Loader2,
  Radar,
} from "lucide-react";
import { PlaceBetDialog } from "@/components/place-bet-dialog";
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
  if (confidence >= 80) return "text-emerald-400";
  if (confidence >= 60) return "text-amber-400";
  return "text-zinc-400";
}

function recommendationBadge(rec: string) {
  if (rec === "BUY_YES") return { label: "YES", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
  if (rec === "BUY_NO") return { label: "NO", className: "bg-red-500/20 text-red-400 border-red-500/30" };
  return { label: "SKIP", className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" };
}

export default function DashboardPage() {
  const today = new Date();
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json()),
    refetchInterval: POLL_INTERVAL,
  });

  const { data: recsData } = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => fetch("/api/recommendations?limit=10").then((r) => r.json()),
    refetchInterval: POLL_INTERVAL,
  });

  const { data: betsData } = useQuery({
    queryKey: ["activeBets"],
    queryFn: () => fetch("/api/bets?status=open&limit=10").then((r) => r.json()),
    refetchInterval: POLL_INTERVAL,
  });

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });

  const runScan = useMutation({
    mutationFn: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180_000); // 3 min client timeout
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
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["activeBets"] });
      toast.success(
        `Scanned ${data.marketsScanned} markets, analyzed ${data.marketsAnalyzed}, ${data.recommendationsCreated} new picks`
      );
    },
    onError: (error: Error) => {
      if (error.name === "AbortError") {
        toast.error("Scan timed out — try again or check results later");
        queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      } else {
        toast.error(error.message);
      }
    },
  });

  const executeBet = useMutation({
    mutationFn: async (data: {
      marketTicker: string;
      side: string;
      contracts: number;
      entryPrice: number;
      mode: string;
      recommendationId: string;
    }) => {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to place bet");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activeBets"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["bets"] });
      toast.success(
        `Placed ${variables.side.toUpperCase()} x ${variables.contracts} on ${variables.marketTicker} (${variables.mode})`
      );
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const recommendations = Array.isArray(recsData) ? recsData : recsData?.recommendations ?? [];
  const activeBets = betsData?.bets ?? [];

  const statCards = [
    {
      title: "Win Rate",
      value: stats?.winRate != null ? `${(stats.winRate * 100).toFixed(1)}%` : "\u2014%",
      description: stats?.totalResolved ? `${stats.totalResolved} resolved bets` : "No resolved bets",
      icon: TrendingUp,
      accent: stats?.winRate != null ? (stats.winRate >= 0.6 ? "text-emerald-400" : stats.winRate >= 0.5 ? "text-amber-400" : "text-red-400") : "text-zinc-500",
      iconBg: stats?.winRate != null ? "bg-emerald-500/10" : "bg-zinc-800/50",
    },
    {
      title: "Total P&L",
      value: stats?.totalPnl != null ? formatPnl(stats.totalPnl) : "$0.00",
      description: "Lifetime profit/loss",
      icon: DollarSign,
      accent: stats?.totalPnl > 0 ? "text-emerald-400" : stats?.totalPnl < 0 ? "text-red-400" : "text-zinc-500",
      iconBg: stats?.totalPnl > 0 ? "bg-emerald-500/10" : stats?.totalPnl < 0 ? "bg-red-500/10" : "bg-zinc-800/50",
    },
    {
      title: "Active Bets",
      value: String(stats?.activeCount ?? 0),
      description: "Open positions",
      icon: Target,
      accent: stats?.activeCount > 0 ? "text-blue-400" : "text-zinc-500",
      iconBg: stats?.activeCount > 0 ? "bg-blue-500/10" : "bg-zinc-800/50",
    },
    {
      title: "Current Streak",
      value: stats?.streak ? `${stats.streak}${stats.streakType}` : "\u2014",
      description: stats?.streak ? `${stats.streak} consecutive ${stats.streakType === "W" ? "wins" : "losses"}` : "No streak",
      icon: Flame,
      accent: stats?.streakType === "W" ? "text-emerald-400" : stats?.streakType === "L" ? "text-red-400" : "text-zinc-500",
      iconBg: stats?.streakType === "W" ? "bg-emerald-500/10" : stats?.streakType === "L" ? "bg-red-500/10" : "bg-zinc-800/50",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-400">{formatDate(today)}</p>
        </div>
        <Button
          onClick={() => runScan.mutate()}
          disabled={runScan.isPending}
          className="bg-violet-600 hover:bg-violet-700 text-white font-semibold min-h-[44px]"
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
            <Card key={stat.title} className="border-zinc-800/60 bg-zinc-900/50">
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {stat.title}
                </CardDescription>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.iconBg}`}>
                  <Icon className={`h-4 w-4 ${stat.accent}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-xl sm:text-2xl font-bold ${stat.accent}`}>{stat.value}</div>
                <p className="mt-1 text-xs text-zinc-600">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Today's Picks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Today&apos;s Picks</h2>
            <p className="text-sm text-zinc-500">AI-recommended trades</p>
          </div>
          <Badge variant="outline" className="border-zinc-700 text-zinc-400">
            {recommendations.length} pick{recommendations.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {recommendations.length === 0 ? (
          <Card className="border-zinc-800/60 bg-zinc-900/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/60">
                <Inbox className="h-6 w-6 text-zinc-600" />
              </div>
              <p className="mt-4 text-center text-sm text-zinc-500 max-w-sm">
                No recommendations yet. The scanner runs every 4 hours &mdash; check back soon.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {recommendations.filter((r: Record<string, unknown>) => r.recommendation !== "SKIP").map((rec: Record<string, unknown>) => {
              const badge = recommendationBadge(rec.recommendation as string);
              return (
                <Card key={rec.id as string} className="border-zinc-800/60 bg-zinc-900/50">
                  <CardContent className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap sm:gap-4 sm:py-4">
                    <Badge className={badge.className}>{badge.label}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {(rec.marketTitle ?? rec.market_ticker ?? rec.marketTicker) as string}
                      </p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{rec.reasoning as string}</p>
                    </div>
                    <div className="text-right shrink-0 mr-2">
                      <p className={`text-sm font-semibold ${confidenceColor(rec.confidence as number)}`}>
                        {rec.confidence as number}%
                      </p>
                      <p className="text-xs text-zinc-600">confidence</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
                      <Button
                        size="sm"
                        onClick={() =>
                          executeBet.mutate({
                            marketTicker: (rec.marketTicker ?? rec.market_ticker) as string,
                            side: rec.recommendation === "BUY_NO" ? "no" : "yes",
                            contracts: (rec.suggestedSize as number) ?? 10,
                            entryPrice: 0.5,
                            mode: settingsData?.tradingMode ?? "paper",
                            recommendationId: rec.id as string,
                          })
                        }
                        disabled={executeBet.isPending}
                        className={cn(
                          "font-semibold",
                          settingsData?.tradingMode === "real"
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        )}
                      >
                        {executeBet.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : settingsData?.tradingMode === "real" ? (
                          "Execute (Real $)"
                        ) : (
                          "Execute"
                        )}
                      </Button>
                      <PlaceBetDialog
                        marketTicker={(rec.marketTicker ?? rec.market_ticker) as string}
                        marketTitle={(rec.marketTitle ?? rec.market_ticker ?? rec.marketTicker) as string}
                        currentYesPrice={0.5}
                        recommendationId={rec.id as string}
                        suggestedSide={rec.recommendation === "BUY_NO" ? "no" : "yes"}
                        suggestedContracts={(rec.suggestedSize as number) ?? 10}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Bets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Active Bets</h2>
            <p className="text-sm text-zinc-500">Currently open positions</p>
          </div>
          <Badge variant="outline" className="border-zinc-700 text-zinc-400">
            {activeBets.length} active
          </Badge>
        </div>

        {activeBets.length === 0 ? (
          <Card className="border-zinc-800/60 bg-zinc-900/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/60">
                <CircleDot className="h-6 w-6 text-zinc-600" />
              </div>
              <p className="mt-4 text-sm text-zinc-500">No active bets</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {activeBets.map((bet: Record<string, unknown>) => (
              <Card key={bet.id as string} className="border-zinc-800/60 bg-zinc-900/50">
                <CardContent className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap sm:gap-4 sm:py-4">
                  <Badge className={bet.side === "yes" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                    {(bet.side as string)?.toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {(bet.marketTitle ?? bet.marketTicker) as string}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {bet.contracts as number} contracts @ ${Number(bet.entryPrice).toFixed(2)} &middot; {bet.mode as string}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-zinc-300">
                      ${Number(bet.totalCost ?? 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-zinc-600">at risk</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
