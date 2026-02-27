"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Unplug } from "lucide-react";
import { cn } from "@/lib/utils";

const categories = [
  "All",
  "Weather",
  "Economics",
  "Sports",
  "Politics",
  "Other",
];

function timeUntilClose(closeTime: string | null) {
  if (!closeTime) return "No close date";
  const diff = new Date(closeTime).getTime() - Date.now();
  if (diff <= 0) return "Closed";
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  return `${hours}h`;
}

export default function MarketsPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["markets"],
    queryFn: () => fetch("/api/markets?status=open&limit=200").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const allMarkets: Record<string, unknown>[] = data?.markets ?? [];

  // Client-side filtering
  const filtered = allMarkets.filter((m) => {
    const title = String(m.title ?? "").toLowerCase();
    const category = String(m.category ?? "other").toLowerCase();

    if (searchQuery && !title.includes(searchQuery.toLowerCase())) return false;
    if (activeCategory !== "All" && category !== activeCategory.toLowerCase()) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Markets
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Browse and analyze prediction markets
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-zinc-800 bg-zinc-900/50 pl-9 text-zinc-300 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-all whitespace-nowrap",
              activeCategory === category
                ? "bg-emerald-500/15 text-emerald-400"
                : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          <span className="ml-2 text-sm text-zinc-500">Loading markets...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardContent className="flex flex-col items-center justify-center py-24">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800/60">
              <Unplug className="h-7 w-7 text-zinc-600" />
            </div>
            <p className="mt-4 text-center text-sm text-zinc-500 max-w-md">
              Failed to load markets. Check your Kalshi API key in Settings.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && filtered.length === 0 && (
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardContent className="flex flex-col items-center justify-center py-24">
            <p className="text-sm text-zinc-500">
              {allMarkets.length === 0 ? "No markets available" : "No markets match your filters"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Market Cards Grid */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((market) => {
            const ticker = String(market.ticker);
            const title = String(market.title ?? ticker);
            const yesPrice = Number(market.yes_price ?? market.yes_bid ?? 0);
            const volume = Number(market.volume_24h ?? market.volume ?? 0);
            const category = String(market.category ?? "other");
            const closeTime = (market.close_time ?? market.expected_expiration ?? null) as string | null;

            return (
              <Link key={ticker} href={`/markets/${encodeURIComponent(ticker)}`}>
                <Card className="border-zinc-800/60 bg-zinc-900/50 hover:bg-zinc-900/80 hover:border-zinc-700/60 transition-all cursor-pointer h-full">
                  <CardContent className="space-y-3 pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-white leading-snug line-clamp-2">
                        {title}
                      </p>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px] shrink-0 capitalize">
                        {category}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-xs text-zinc-600">YES</p>
                          <p className={cn(
                            "text-sm font-semibold",
                            yesPrice >= 0.6 ? "text-emerald-400" : yesPrice <= 0.4 ? "text-red-400" : "text-zinc-300"
                          )}>
                            {(yesPrice * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-600">NO</p>
                          <p className={cn(
                            "text-sm font-semibold",
                            (1 - yesPrice) >= 0.6 ? "text-emerald-400" : (1 - yesPrice) <= 0.4 ? "text-red-400" : "text-zinc-300"
                          )}>
                            {((1 - yesPrice) * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-zinc-600">Vol: {volume.toLocaleString()}</p>
                        <p className="text-[10px] text-zinc-600">{timeUntilClose(closeTime)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
