"use client";

import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlaceBetDialog } from "@/components/place-bet-dialog";
import {
  ArrowLeft,
  Clock,
  BarChart3,
  TrendingUp,
  Loader2,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";

function timeUntilClose(closeTime: string | null) {
  if (!closeTime) return "No close date";
  const diff = new Date(closeTime).getTime() - Date.now();
  if (diff <= 0) return "Closed";
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h left`;
  const minutes = Math.floor(diff / 60_000);
  return `${minutes}m left`;
}

function confidenceColor(confidence: number) {
  if (confidence >= 80) return "text-emerald-400";
  if (confidence >= 60) return "text-amber-400";
  return "text-zinc-400";
}

export default function MarketDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = use(params);
  const decodedTicker = decodeURIComponent(ticker);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["market", decodedTicker],
    queryFn: () =>
      fetch(`/api/markets/${encodeURIComponent(decodedTicker)}`).then((r) =>
        r.json()
      ),
    refetchInterval: 30_000,
  });

  const { data: recsData } = useQuery({
    queryKey: ["marketRecs", decodedTicker],
    queryFn: () =>
      fetch(`/api/recommendations?limit=5`).then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const analyzeMarket = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: decodedTicker }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketRecs", decodedTicker] });
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
    },
  });

  const marketData = data?.market?.market ?? data?.market ?? {};
  const orderbookData = data?.orderbook?.orderbook ?? data?.orderbook ?? {};

  const title = marketData.title ?? decodedTicker;
  const yesPrice = Number(marketData.yes_price ?? marketData.yes_bid ?? 0);
  const noPrice = 1 - yesPrice;
  const volume = Number(marketData.volume_24h ?? marketData.volume ?? 0);
  const openInterest = Number(marketData.open_interest ?? 0);
  const closeTime = (marketData.close_time ?? marketData.expected_expiration ?? null) as string | null;
  const category = String(marketData.category ?? "unknown");
  const status = String(marketData.status ?? "open");

  // Find latest recommendation for this market
  const allRecs = recsData?.recommendations ?? [];
  const latestRec = allRecs.find(
    (r: Record<string, unknown>) => r.marketTicker === decodedTicker
  );

  // Orderbook summary
  const yesLevels = orderbookData?.yes ?? [];
  const noLevels = orderbookData?.no ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        <span className="ml-2 text-sm text-zinc-500">Loading market...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/markets" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-4 w-4" /> Back to Markets
        </Link>
        <p className="text-red-400">Failed to load market details.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/markets" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="h-4 w-4" /> Back to Markets
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-white">
            {title}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px] capitalize">
              {category}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                status === "open"
                  ? "border-emerald-500/30 text-emerald-400"
                  : "border-zinc-700 text-zinc-500"
              )}
            >
              {status}
            </Badge>
            <span className="text-xs text-zinc-600">{decodedTicker}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => analyzeMarket.mutate()}
            disabled={analyzeMarket.isPending}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            {analyzeMarket.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Brain className="h-4 w-4 mr-1" />
            )}
            Analyze with AI
          </Button>
          <PlaceBetDialog
            marketTicker={decodedTicker}
            marketTitle={title}
            currentYesPrice={yesPrice}
            suggestedSide={latestRec?.recommendation === "BUY_NO" ? "no" : "yes"}
            suggestedContracts={latestRec?.suggestedSize ?? 10}
            recommendationId={latestRec?.id}
          />
        </div>
      </div>

      {/* Price Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardContent className="pt-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">YES Price</p>
            <p className={cn(
              "text-2xl font-bold mt-1",
              yesPrice >= 0.6 ? "text-emerald-400" : yesPrice <= 0.4 ? "text-red-400" : "text-zinc-300"
            )}>
              {(yesPrice * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardContent className="pt-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">NO Price</p>
            <p className={cn(
              "text-2xl font-bold mt-1",
              noPrice >= 0.6 ? "text-emerald-400" : noPrice <= 0.4 ? "text-red-400" : "text-zinc-300"
            )}>
              {(noPrice * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardContent className="pt-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Volume (24h)</p>
            <p className="text-2xl font-bold mt-1 text-zinc-300">
              {volume.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardContent className="pt-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Time Left</p>
            <p className="text-2xl font-bold mt-1 text-zinc-300">
              {timeUntilClose(closeTime)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Orderbook */}
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-sm text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-zinc-500" />
              Orderbook
            </CardTitle>
            <CardDescription className="text-zinc-500">
              {yesLevels.length} YES levels, {noLevels.length} NO levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            {yesLevels.length === 0 && noLevels.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-8">No orderbook data available</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-emerald-400 font-medium mb-2 uppercase tracking-wider">YES Bids</p>
                  <div className="space-y-1">
                    {yesLevels.slice(0, 8).map((level: [number, number], i: number) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-zinc-400">{level[0]}c</span>
                        <span className="text-zinc-500">{level[1]}</span>
                      </div>
                    ))}
                    {yesLevels.length === 0 && <p className="text-xs text-zinc-600">No bids</p>}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-red-400 font-medium mb-2 uppercase tracking-wider">NO Bids</p>
                  <div className="space-y-1">
                    {noLevels.slice(0, 8).map((level: [number, number], i: number) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-zinc-400">{level[0]}c</span>
                        <span className="text-zinc-500">{level[1]}</span>
                      </div>
                    ))}
                    {noLevels.length === 0 && <p className="text-xs text-zinc-600">No bids</p>}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Recommendation */}
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-sm text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-zinc-500" />
              AI Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyzeMarket.isPending ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                <span className="text-sm text-zinc-500">Analyzing market...</span>
              </div>
            ) : latestRec ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge className={cn(
                    "text-sm px-3 py-1",
                    latestRec.recommendation === "BUY_YES"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : latestRec.recommendation === "BUY_NO"
                      ? "bg-red-500/20 text-red-400 border-red-500/30"
                      : "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
                  )}>
                    {latestRec.recommendation === "BUY_YES" ? "BUY YES" : latestRec.recommendation === "BUY_NO" ? "BUY NO" : "SKIP"}
                  </Badge>
                  <span className={cn("text-lg font-bold", confidenceColor(latestRec.confidence))}>
                    {latestRec.confidence}%
                  </span>
                  <span className="text-xs text-zinc-600">confidence</span>
                </div>
                {latestRec.reasoning && (
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {latestRec.reasoning}
                  </p>
                )}
                {latestRec.keyRisk && (
                  <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Key Risk</p>
                    <p className="text-sm text-red-400/80">{latestRec.keyRisk}</p>
                  </div>
                )}
                {latestRec.suggestedSize && (
                  <p className="text-xs text-zinc-600">
                    Suggested size: {latestRec.suggestedSize} contracts
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-zinc-500 mb-3">No AI analysis yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => analyzeMarket.mutate()}
                  disabled={analyzeMarket.isPending}
                  className="border-zinc-700 text-zinc-300"
                >
                  <Brain className="h-4 w-4 mr-1" />
                  Run Analysis
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Market Info */}
      <Card className="border-zinc-800/60 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-500" />
            Market Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-zinc-600">Open Interest</p>
              <p className="text-sm font-medium text-zinc-300 mt-0.5">{openInterest.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-600">Close Time</p>
              <p className="text-sm font-medium text-zinc-300 mt-0.5">
                {closeTime ? new Date(closeTime).toLocaleString() : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-600">Event</p>
              <p className="text-sm font-medium text-zinc-300 mt-0.5">{marketData.event_ticker ?? "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-600">Series</p>
              <p className="text-sm font-medium text-zinc-300 mt-0.5">{marketData.series_ticker ?? "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
