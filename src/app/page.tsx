"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  DollarSign,
  Target,
  Flame,
  Inbox,
  CircleDot,
} from "lucide-react";

const stats = [
  {
    title: "Win Rate",
    value: "\u2014%",
    description: "No resolved bets",
    icon: TrendingUp,
    accent: "text-zinc-500",
    iconBg: "bg-zinc-800/50",
  },
  {
    title: "Total P&L",
    value: "$0.00",
    description: "Lifetime profit/loss",
    icon: DollarSign,
    accent: "text-zinc-500",
    iconBg: "bg-zinc-800/50",
  },
  {
    title: "Active Bets",
    value: "0",
    description: "Open positions",
    icon: Target,
    accent: "text-zinc-500",
    iconBg: "bg-zinc-800/50",
  },
  {
    title: "Current Streak",
    value: "\u2014",
    description: "Consecutive wins/losses",
    icon: Flame,
    accent: "text-zinc-500",
    iconBg: "bg-zinc-800/50",
  },
];

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const today = new Date();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-400">{formatDate(today)}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className="border-zinc-800/60 bg-zinc-900/50"
            >
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {stat.title}
                </CardDescription>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.iconBg}`}
                >
                  <Icon className={`h-4 w-4 ${stat.accent}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.accent}`}>
                  {stat.value}
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Today's Picks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Today&apos;s Picks
            </h2>
            <p className="text-sm text-zinc-500">
              AI-recommended trades for today
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-zinc-700 text-zinc-500"
          >
            0 picks
          </Badge>
        </div>

        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/60">
              <Inbox className="h-6 w-6 text-zinc-600" />
            </div>
            <p className="mt-4 text-center text-sm text-zinc-500 max-w-sm">
              No recommendations yet. Configure your Kalshi API key in Settings
              to start scanning.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Bets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Active Bets</h2>
            <p className="text-sm text-zinc-500">
              Currently open positions
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-zinc-700 text-zinc-500"
          >
            0 active
          </Badge>
        </div>

        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/60">
              <CircleDot className="h-6 w-6 text-zinc-600" />
            </div>
            <p className="mt-4 text-sm text-zinc-500">No active bets</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
