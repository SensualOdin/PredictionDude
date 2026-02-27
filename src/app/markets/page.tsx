"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Unplug } from "lucide-react";
import { cn } from "@/lib/utils";

const categories = [
  "All",
  "Weather",
  "Economics",
  "Sports",
  "Politics",
  "Other",
];

export default function MarketsPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

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

      {/* Empty State */}
      <Card className="border-zinc-800/60 bg-zinc-900/50">
        <CardContent className="flex flex-col items-center justify-center py-24">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800/60">
            <Unplug className="h-7 w-7 text-zinc-600" />
          </div>
          <p className="mt-4 text-center text-sm text-zinc-500 max-w-md">
            Connect your Kalshi API key to browse live markets.
          </p>
          <Badge
            variant="outline"
            className="mt-4 border-zinc-700 text-zinc-500"
          >
            API Not Connected
          </Badge>
        </CardContent>
      </Card>

      {/* Placeholder Market Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card
            key={i}
            className="border-zinc-800/40 bg-zinc-900/30"
          >
            <CardContent className="space-y-3 pt-6">
              <div className="h-4 w-3/4 rounded bg-zinc-800/60" />
              <div className="h-3 w-1/2 rounded bg-zinc-800/40" />
              <div className="flex items-center justify-between pt-2">
                <div className="h-6 w-16 rounded bg-zinc-800/40" />
                <div className="h-6 w-20 rounded bg-zinc-800/40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
