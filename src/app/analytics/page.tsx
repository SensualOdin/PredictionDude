"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LineChart,
  BarChart3,
  ScatterChart,
  AreaChart,
  TrendingUp,
} from "lucide-react";

const chartPlaceholders = [
  {
    title: "Win Rate Over Time",
    description: "Historical win rate trend",
    icon: LineChart,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    title: "Accuracy by Category",
    description: "Prediction accuracy per market category",
    icon: BarChart3,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    title: "Confidence Calibration",
    description: "Predicted vs. actual probability",
    icon: ScatterChart,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    title: "P&L Curve",
    description: "Cumulative profit and loss over time",
    icon: AreaChart,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Performance metrics and insights
        </p>
      </div>

      {/* Overview Banner */}
      <Card className="border-zinc-800/60 bg-zinc-900/50">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-300">
              Place some bets to start seeing analytics.
            </p>
            <p className="text-xs text-zinc-600">
              Charts will populate as you build a trading history.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Chart Placeholders */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {chartPlaceholders.map((chart) => {
          const Icon = chart.icon;
          return (
            <Card
              key={chart.title}
              className="border-zinc-800/60 bg-zinc-900/50"
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${chart.bg}`}
                  >
                    <Icon className={`h-4 w-4 ${chart.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-zinc-200">
                      {chart.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-600">
                      {chart.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Chart placeholder area */}
                <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-zinc-800/60 bg-zinc-950/50">
                  <div className="flex flex-col items-center gap-2">
                    <Icon className="h-8 w-8 text-zinc-800" />
                    <p className="text-xs text-zinc-700">
                      No data available
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
