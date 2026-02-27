"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => fetch("/api/analytics").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const { data: statsData } = useQuery({
    queryKey: ["stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json()),
  });

  const winRateData = (data?.winRateOverTime ?? []).map((d: Record<string, unknown>) => ({
    week: String(d.week ?? "").slice(5, 10),
    winRate: Number(d.win_rate ?? 0) * 100,
    total: Number(d.total ?? 0),
  }));

  const categoryData = (data?.accuracyByCategory ?? []).map((d: Record<string, unknown>) => ({
    category: String(d.category ?? "unknown"),
    winRate: Number(d.win_rate ?? 0) * 100,
    total: Number(d.total ?? 0),
  }));

  const calibrationData = (data?.confidenceCalibration ?? []).map((d: Record<string, unknown>) => ({
    bucket: String(d.bucket ?? ""),
    predicted: Number(d.avg_confidence ?? 0),
    actual: Number(d.actual_rate ?? 0) * 100,
    total: Number(d.total ?? 0),
  }));

  const pnlData = (data?.pnlCurve ?? []).map((d: Record<string, unknown>) => ({
    day: String(d.day ?? "").slice(5, 10),
    cumulative: Number(d.cumulative_pnl ?? 0),
    daily: Number(d.daily_pnl ?? 0),
  }));

  const hasData = winRateData.length > 0 || categoryData.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Performance metrics and insights
        </p>
      </div>

      {/* Overview Stats */}
      <Card className="border-zinc-800/60 bg-zinc-900/50">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            {statsData?.totalResolved ? (
              <>
                <p className="text-sm font-medium text-zinc-300">
                  {statsData.totalResolved} resolved bets &middot;{" "}
                  {statsData.winRate != null
                    ? `${(statsData.winRate * 100).toFixed(1)}% win rate`
                    : "calculating..."}{" "}
                  &middot;{" "}
                  <span className={statsData.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {statsData.totalPnl >= 0 ? "+" : ""}${Number(statsData.totalPnl ?? 0).toFixed(2)} P&L
                  </span>
                </p>
                <p className="text-xs text-zinc-600">
                  Charts update as you build trading history
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-zinc-300">
                  Place some bets to start seeing analytics.
                </p>
                <p className="text-xs text-zinc-600">
                  Charts will populate as you build a trading history.
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          <span className="ml-2 text-sm text-zinc-500">Loading analytics...</span>
        </div>
      )}

      {/* Charts */}
      {!isLoading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Win Rate Over Time */}
          <Card className="min-h-[200px] border-zinc-800/60 bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200">
                Win Rate Over Time
              </CardTitle>
              <CardDescription className="text-xs text-zinc-600">
                Weekly win rate trend
              </CardDescription>
            </CardHeader>
            <CardContent>
              {winRateData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={winRateData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="week" tick={{ fill: "#71717a", fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                      labelStyle={{ color: "#a1a1aa" }}
                      itemStyle={{ color: "#34d399" }}
                    />
                    <ReferenceLine y={50} stroke="#3f3f46" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="winRate"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={{ fill: "#34d399", r: 3 }}
                      name="Win Rate %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Accuracy by Category */}
          <Card className="min-h-[200px] border-zinc-800/60 bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200">
                Accuracy by Category
              </CardTitle>
              <CardDescription className="text-xs text-zinc-600">
                Win rate per market category
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="category" tick={{ fill: "#71717a", fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                      labelStyle={{ color: "#a1a1aa" }}
                    />
                    <ReferenceLine y={50} stroke="#3f3f46" strokeDasharray="3 3" />
                    <Bar dataKey="winRate" fill="#60a5fa" radius={[4, 4, 0, 0]} name="Win Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Confidence Calibration */}
          <Card className="min-h-[200px] border-zinc-800/60 bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200">
                Confidence Calibration
              </CardTitle>
              <CardDescription className="text-xs text-zinc-600">
                Predicted confidence vs actual hit rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              {calibrationData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      type="number"
                      dataKey="predicted"
                      domain={[40, 100]}
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      name="Predicted %"
                    />
                    <YAxis
                      type="number"
                      dataKey="actual"
                      domain={[0, 100]}
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      name="Actual %"
                    />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                      labelStyle={{ color: "#a1a1aa" }}
                    />
                    <ReferenceLine segment={[{ x: 40, y: 40 }, { x: 100, y: 100 }]} stroke="#3f3f46" strokeDasharray="3 3" />
                    <Scatter data={calibrationData} fill="#a78bfa" name="Calibration" />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* P&L Curve */}
          <Card className="min-h-[200px] border-zinc-800/60 bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200">
                P&L Curve
              </CardTitle>
              <CardDescription className="text-xs text-zinc-600">
                Cumulative profit and loss over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pnlData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={pnlData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                      labelStyle={{ color: "#a1a1aa" }}
                      formatter={(value: unknown) => [`$${Number(value ?? 0).toFixed(2)}`, "P&L"]}
                    />
                    <ReferenceLine y={0} stroke="#3f3f46" />
                    <defs>
                      <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="url(#pnlGradient)"
                      name="Cumulative P&L"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-zinc-800/60 bg-zinc-950/50">
      <p className="text-xs text-zinc-700">No data available</p>
    </div>
  );
}
