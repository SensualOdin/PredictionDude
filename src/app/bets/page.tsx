"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ListX, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const POLL_INTERVAL = 30_000;

function statusBadge(status: string, outcome: string | null) {
  if (status === "open") return { label: "Open", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  if (outcome === "hit") return { label: "Won", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
  if (outcome === "miss") return { label: "Lost", className: "bg-red-500/20 text-red-400 border-red-500/30" };
  return { label: status, className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" };
}

function formatPnl(pnl: string | number | null) {
  if (pnl == null) return "\u2014";
  const val = Number(pnl);
  const sign = val >= 0 ? "+" : "";
  return `${sign}$${val.toFixed(2)}`;
}

function pnlColor(pnl: string | number | null) {
  if (pnl == null) return "text-zinc-500";
  const val = Number(pnl);
  if (val > 0) return "text-emerald-400";
  if (val < 0) return "text-red-400";
  return "text-zinc-500";
}

export default function BetsPage() {
  const [activeTab, setActiveTab] = useState("active");
  const [mode, setMode] = useState("all");

  // Build query params based on tab
  const queryParams = new URLSearchParams();
  if (activeTab === "active") queryParams.set("status", "open");
  if (mode !== "all") queryParams.set("mode", mode);
  queryParams.set("limit", "100");

  const { data, isLoading } = useQuery({
    queryKey: ["bets", activeTab, mode],
    queryFn: () => fetch(`/api/bets?${queryParams.toString()}`).then((r) => r.json()),
    refetchInterval: POLL_INTERVAL,
  });

  const allBets: Record<string, unknown>[] = data?.bets ?? [];

  // Client-side filter for "resolved" tab (won/lost statuses)
  const displayBets = activeTab === "resolved"
    ? allBets.filter((b) => b.status === "won" || b.status === "lost")
    : allBets;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Bet Tracker
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Track and manage all your positions
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="bg-zinc-900 border border-zinc-800/60">
            <TabsTrigger
              value="active"
              className="min-h-[44px] data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              Active
            </TabsTrigger>
            <TabsTrigger
              value="resolved"
              className="min-h-[44px] data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              Resolved
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="min-h-[44px] data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              All
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-32 border-zinc-800 bg-zinc-900/50 text-zinc-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-900">
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="paper">Paper</SelectItem>
                <SelectItem value="real">Real</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value={activeTab}>
          <BetsTable bets={displayBets} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BetsTable({ bets, isLoading }: { bets: Record<string, unknown>[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        <span className="ml-2 text-sm text-zinc-500">Loading bets...</span>
      </div>
    );
  }

  if (bets.length === 0) {
    return (
      <Card className="border-zinc-800/60 bg-zinc-900/50">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/60">
              <ListX className="h-6 w-6 text-zinc-600" />
            </div>
            <p className="mt-3 text-sm text-zinc-500">
              No bets to display
            </p>
            <Badge
              variant="outline"
              className="mt-2 border-zinc-700 text-zinc-600 text-[10px]"
            >
              Place a bet to get started
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Desktop table view */}
      <div className="hidden sm:block">
        <Card className="border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800/60 hover:bg-transparent">
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                    Market
                  </TableHead>
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                    Side
                  </TableHead>
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                    Entry
                  </TableHead>
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                    Size
                  </TableHead>
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                    Cost
                  </TableHead>
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                    P&L
                  </TableHead>
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                    Status
                  </TableHead>
                  <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                    Mode
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bets.map((bet) => {
                  const badge = statusBadge(bet.status as string, bet.outcome as string | null);
                  return (
                    <TableRow key={bet.id as string} className="border-zinc-800/60 hover:bg-zinc-800/30">
                      <TableCell className="text-sm text-white max-w-[200px] truncate">
                        {(bet.marketTitle ?? bet.marketTicker) as string}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "text-[10px]",
                          bet.side === "yes"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                        )}>
                          {(bet.side as string)?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-300">
                        ${Number(bet.entryPrice).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-300">
                        {bet.contracts as number}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-300">
                        ${Number(bet.totalCost ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell className={cn("text-sm font-medium", pnlColor(bet.pnl as string | null))}>
                        {formatPnl(bet.pnl as string | null)}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-[10px]", badge.className)}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px] capitalize">
                          {bet.mode as string}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Mobile card view */}
      <div className="block sm:hidden space-y-3">
        {bets.map((bet) => {
          const badge = statusBadge(bet.status as string, bet.outcome as string | null);
          const side = bet.side as string;
          const pnl = bet.pnl as string | number | null;
          return (
            <Card key={bet.id as string} className="border-zinc-800/60 bg-zinc-900/50">
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={cn(
                      "text-[10px]",
                      side === "yes"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/20 text-red-400 border-red-500/30"
                    )}>
                      {side?.toUpperCase()}
                    </Badge>
                    <span className="text-sm font-medium text-white truncate max-w-[200px]">
                      {(bet.marketTitle ?? bet.marketTicker) as string}
                    </span>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px]", badge.className)}>
                    {badge.label}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    {bet.contracts as number} contracts @ ${Number(bet.entryPrice).toFixed(2)} · {bet.mode as string}
                  </span>
                  {pnl != null && (
                    <span className={Number(pnl) >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {formatPnl(pnl)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
