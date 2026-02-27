# Phase 2: AI Scanner — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up Claude's web search tool for real-time market analysis, add historical performance tracking, and connect the dashboard to live data with 30s polling.

**Architecture:** The AI engine gains web search (Anthropic built-in tool) so Claude can autonomously fetch news/weather/economic data during analysis. A new performance helper queries resolved bets for category win rates and confidence calibration. The dashboard switches from hardcoded static data to React Query hooks polling real API endpoints.

**Tech Stack:** Next.js 16, Anthropic SDK (web_search_20250305 tool), Drizzle ORM, React Query, Supabase/Postgres

---

### Task 1: Update AI Engine — Add Web Search Tool

**Files:**
- Modify: `src/lib/ai/engine.ts:37` (MODEL constant), `src/lib/ai/engine.ts:113-140` (analyzeMarket method)
- Modify: `src/lib/ai/prompts.ts:8-21` (MarketAnalysisPromptParams), `src/lib/ai/prompts.ts:39-91` (buildMarketAnalysisPrompt)

**Context:** The Anthropic API supports a `web_search_20250305` server-side tool. When included in the tools array, Claude autonomously decides when to search the web. The response contains interleaved `server_tool_use`, `web_search_tool_result`, and `text` content blocks. We need to extract the JSON recommendation from the **last** text block.

**Step 1: Update prompts.ts — remove external_context from MarketAnalysisPromptParams**

The `external_context` field is no longer needed since Claude will search the web itself. Remove it from the interface and prompt builder. Update the prompt system message to tell Claude it has web search.

In `src/lib/ai/prompts.ts`:

- Remove `external_context: string;` from `MarketAnalysisPromptParams` (line 15)
- Remove the `external_context` destructuring and `EXTERNAL CONTEXT:` block from the prompt builder
- Add a line to the prompt: `You have access to a web search tool. Use it to find current news, weather forecasts, economic data, or any other context relevant to this market before making your recommendation.`

**Step 2: Update engine.ts — add web search tool to analyzeMarket()**

In `src/lib/ai/engine.ts`:

- Change the `messages.create()` call in `analyzeMarket()` to include `tools`:
```typescript
const response = await this.client.messages.create({
  model: MODEL,
  max_tokens: MAX_TOKENS,
  messages: [{ role: "user", content: prompt }],
  tools: [
    {
      type: "web_search_20250305" as const,
      name: "web_search",
      max_uses: 3,
    },
  ],
});
```

- Update the response parsing. Instead of finding the first `text` block, find the **last** text block (Claude puts its final answer after all search results):
```typescript
const textBlocks = response.content.filter(
  (block): block is Anthropic.TextBlock => block.type === "text",
);
const lastTextBlock = textBlocks[textBlocks.length - 1];
if (!lastTextBlock) {
  console.error("[AIEngine] No text block in Claude response");
  return null;
}
const parsed = extractJSON<unknown>(lastTextBlock.text);
return validateAIAnalysis(parsed);
```

- Increase `MAX_TOKENS` from `1024` to `4096` (web search results consume tokens, Claude needs room for its answer)

- Handle `pause_turn` stop reason: if `response.stop_reason === "pause_turn"`, we need to continue the conversation by sending the response back. Add a loop:
```typescript
let response = await this.client.messages.create({ ... });
// Handle pause_turn — Claude may need multiple rounds for web search
while (response.stop_reason === "pause_turn") {
  response = await this.client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: "user", content: prompt },
      { role: "assistant", content: response.content },
      { role: "user", content: "Please continue your analysis." },
    ],
    tools: [
      {
        type: "web_search_20250305" as const,
        name: "web_search",
        max_uses: 3,
      },
    ],
  });
}
```

**Step 3: Update cron/scan to remove external_context param**

In `src/app/api/cron/scan/route.ts`, remove the `external_context: ""` line (line 124) from the `aiEngine.analyzeMarket()` call.

**Step 4: Update recommendations POST route to remove external_context**

Check `src/app/api/recommendations/route.ts` — if it passes `external_context`, remove it.

**Step 5: Verify build passes**

Run: `PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run build`
Expected: Clean build, no TypeScript errors.

**Step 6: Commit**

```bash
git add src/lib/ai/engine.ts src/lib/ai/prompts.ts src/app/api/cron/scan/route.ts src/app/api/recommendations/route.ts
git commit -m "feat: add Claude web search tool to AI market analysis

Claude now autonomously searches the web for news, weather, and economic
data relevant to each market during analysis. Replaces the unused
external_context parameter with built-in web search (max 3 searches per
market to control costs)."
```

---

### Task 2: Add Historical Performance Helper

**Files:**
- Create: `src/lib/ai/performance.ts`
- Modify: `src/lib/ai/index.ts` (add export)

**Context:** The AI prompt already accepts `historical_performance` with `category_win_rate` and `confidence_calibration`, but they're always null/"no data yet". This task queries the bets table to compute real values.

**Step 1: Create performance.ts**

Create `src/lib/ai/performance.ts`:

```typescript
import { db } from "@/lib/db";
import { bets, recommendations } from "@/lib/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";

interface HistoricalPerformance {
  category_win_rate: number | null;
  confidence_calibration: string;
}

export async function getHistoricalPerformance(
  category: string,
): Promise<HistoricalPerformance> {
  // Get all resolved bets in this category by joining bets -> markets
  const resolvedBets = await db.execute(sql`
    SELECT b.outcome, r.confidence
    FROM bets b
    JOIN recommendations r ON b.recommendation_id = r.id
    JOIN markets m ON b.market_ticker = m.ticker
    WHERE m.category = ${category}
      AND b.outcome IS NOT NULL
  `);

  const rows = resolvedBets.rows ?? resolvedBets;

  if (!Array.isArray(rows) || rows.length < 3) {
    return {
      category_win_rate: null,
      confidence_calibration: "insufficient data (need 3+ resolved bets)",
    };
  }

  // Win rate
  const hits = rows.filter((r: any) => r.outcome === "hit").length;
  const winRate = hits / rows.length;

  // Confidence calibration: avg confidence of hits vs misses
  const hitConfidences = rows
    .filter((r: any) => r.outcome === "hit")
    .map((r: any) => Number(r.confidence));
  const missConfidences = rows
    .filter((r: any) => r.outcome === "miss")
    .map((r: any) => Number(r.confidence));

  const avgHitConf =
    hitConfidences.length > 0
      ? hitConfidences.reduce((a: number, b: number) => a + b, 0) / hitConfidences.length
      : 0;
  const avgMissConf =
    missConfidences.length > 0
      ? missConfidences.reduce((a: number, b: number) => a + b, 0) / missConfidences.length
      : 0;

  const calibration = `${rows.length} resolved bets. Avg confidence on hits: ${avgHitConf.toFixed(0)}%, on misses: ${avgMissConf.toFixed(0)}%. Win rate: ${(winRate * 100).toFixed(1)}%.`;

  return {
    category_win_rate: winRate,
    confidence_calibration: calibration,
  };
}
```

**Step 2: Export from index.ts**

Add to `src/lib/ai/index.ts`:
```typescript
export { getHistoricalPerformance } from "./performance";
```

**Step 3: Wire into cron/scan**

In `src/app/api/cron/scan/route.ts`, import `getHistoricalPerformance` and replace the hardcoded values:

```typescript
import { getHistoricalPerformance } from "@/lib/ai";
```

Replace lines 126-129 (the `historical_performance` object):
```typescript
historical_performance: await getHistoricalPerformance(
  String(market.category ?? "unknown")
),
```

**Step 4: Verify build passes**

Run: `PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run build`
Expected: Clean build.

**Step 5: Commit**

```bash
git add src/lib/ai/performance.ts src/lib/ai/index.ts src/app/api/cron/scan/route.ts
git commit -m "feat: add historical performance tracking for AI prompts

Queries resolved bets by category to compute win rate and confidence
calibration. Fed into Claude's analysis prompt so it can adjust
predictions based on past accuracy."
```

---

### Task 3: Create Stats API Route

**Files:**
- Create: `src/app/api/stats/route.ts`

**Context:** The dashboard needs aggregated stats: win rate, total P&L, active bet count, and current streak. This route queries the bets table.

**Step 1: Create the route**

Create `src/app/api/stats/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bets } from "@/lib/db/schema";
import { eq, isNotNull, sql, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get all resolved bets for win rate and P&L
    const resolvedBets = await db
      .select({
        outcome: bets.outcome,
        pnl: bets.pnl,
        resolvedAt: bets.resolvedAt,
      })
      .from(bets)
      .where(isNotNull(bets.outcome))
      .orderBy(desc(bets.resolvedAt));

    // Active bet count
    const activeBets = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bets)
      .where(eq(bets.status, "open"));

    const activeCount = activeBets[0]?.count ?? 0;

    // Win rate
    const hits = resolvedBets.filter((b) => b.outcome === "hit").length;
    const total = resolvedBets.length;
    const winRate = total > 0 ? hits / total : null;

    // Total P&L
    const totalPnl = resolvedBets.reduce(
      (sum, b) => sum + Number(b.pnl ?? 0),
      0,
    );

    // Current streak: count consecutive same outcomes from most recent
    let streak = 0;
    let streakType: "W" | "L" | null = null;
    for (const bet of resolvedBets) {
      const isHit = bet.outcome === "hit";
      if (streakType === null) {
        streakType = isHit ? "W" : "L";
        streak = 1;
      } else if ((isHit && streakType === "W") || (!isHit && streakType === "L")) {
        streak++;
      } else {
        break;
      }
    }

    return NextResponse.json({
      winRate,
      totalPnl,
      activeCount,
      streak,
      streakType,
      totalResolved: total,
    });
  } catch (error) {
    console.error("[Stats API] Failed:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
```

**Step 2: Verify build passes**

Run: `PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run build`

**Step 3: Commit**

```bash
git add src/app/api/stats/route.ts
git commit -m "feat: add /api/stats route for dashboard aggregation

Returns win rate, total P&L, active bet count, and current streak
computed from the bets table."
```

---

### Task 4: Create Bets API Route

**Files:**
- Create: `src/app/api/bets/route.ts`

**Context:** Dashboard Active Bets section and future Bets page need to query bets with filters.

**Step 1: Create the route**

Create `src/app/api/bets/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bets, markets } from "@/lib/db/schema";
import { eq, desc, and, SQL } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const mode = searchParams.get("mode");
    const limit = Number(searchParams.get("limit") ?? 50);

    const conditions: SQL[] = [];
    if (status) conditions.push(eq(bets.status, status));
    if (mode) conditions.push(eq(bets.mode, mode));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({
        id: bets.id,
        marketTicker: bets.marketTicker,
        marketTitle: markets.title,
        mode: bets.mode,
        side: bets.side,
        action: bets.action,
        entryPrice: bets.entryPrice,
        contracts: bets.contracts,
        totalCost: bets.totalCost,
        status: bets.status,
        outcome: bets.outcome,
        exitPrice: bets.exitPrice,
        pnl: bets.pnl,
        placedAt: bets.placedAt,
        resolvedAt: bets.resolvedAt,
      })
      .from(bets)
      .leftJoin(markets, eq(bets.marketTicker, markets.ticker))
      .where(where)
      .orderBy(desc(bets.placedAt))
      .limit(limit);

    return NextResponse.json({ bets: result });
  } catch (error) {
    console.error("[Bets API] Failed:", error);
    return NextResponse.json({ error: "Failed to fetch bets" }, { status: 500 });
  }
}
```

**Step 2: Verify build passes**

Run: `PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run build`

**Step 3: Commit**

```bash
git add src/app/api/bets/route.ts
git commit -m "feat: add /api/bets route with status and mode filters

Supports filtering by status (open/won/lost) and mode (paper/real),
with market title join. Used by dashboard and bets page."
```

---

### Task 5: Add React Query Provider

**Files:**
- Create: `src/lib/providers.tsx`
- Modify: `src/app/layout.tsx`

**Context:** React Query is already in `package.json` (`@tanstack/react-query: ^5.90.21`) but there's no provider set up. The layout needs to wrap children with `QueryClientProvider`.

**Step 1: Create providers.tsx**

Create `src/lib/providers.tsx`:

```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

**Step 2: Wrap layout.tsx with Providers**

In `src/app/layout.tsx`, import `Providers` and wrap `{children}`:

```typescript
import { Providers } from "@/lib/providers";
```

Wrap the body content:
```tsx
<body className={`${inter.variable} font-sans antialiased bg-zinc-950 text-zinc-100`}>
  <Providers>
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pl-16">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  </Providers>
</body>
```

**Step 3: Verify build passes**

Run: `PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run build`

**Step 4: Commit**

```bash
git add src/lib/providers.tsx src/app/layout.tsx
git commit -m "feat: add React Query provider to app layout

Sets up QueryClientProvider with 30s stale time for dashboard polling."
```

---

### Task 6: Rewrite Dashboard with Live Data

**Files:**
- Modify: `src/app/page.tsx` (full rewrite)

**Context:** The dashboard currently shows hardcoded empty states. Replace with React Query hooks that poll `/api/stats`, `/api/recommendations`, and `/api/bets?status=open` every 30 seconds. Keep the existing dark theme and component styling.

**Step 1: Rewrite page.tsx**

Replace `src/app/page.tsx` entirely with:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
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
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";

const POLL_INTERVAL = 30_000;

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-400">{formatDate(today)}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <div className={`text-2xl font-bold ${stat.accent}`}>{stat.value}</div>
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
            {recommendations.filter((r: any) => r.recommendation !== "SKIP").map((rec: any) => {
              const badge = recommendationBadge(rec.recommendation);
              return (
                <Card key={rec.id} className="border-zinc-800/60 bg-zinc-900/50">
                  <CardContent className="flex items-center gap-4 py-4">
                    <Badge className={badge.className}>{badge.label}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {rec.marketTitle ?? rec.market_ticker ?? rec.marketTicker}
                      </p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{rec.reasoning}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${confidenceColor(rec.confidence)}`}>
                        {rec.confidence}%
                      </p>
                      <p className="text-xs text-zinc-600">confidence</p>
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
            {activeBets.map((bet: any) => (
              <Card key={bet.id} className="border-zinc-800/60 bg-zinc-900/50">
                <CardContent className="flex items-center gap-4 py-4">
                  <Badge className={bet.side === "yes" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                    {bet.side?.toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {bet.marketTitle ?? bet.marketTicker}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {bet.contracts} contracts @ ${Number(bet.entryPrice).toFixed(2)} &middot; {bet.mode}
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
```

**Step 2: Verify build passes**

Run: `PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run build`

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: connect dashboard to live data with React Query polling

Stats cards, today's picks, and active bets now fetch real data from
API routes and refresh every 30 seconds."
```

---

### Task 7: Fix Cron Auth to Be Optional

**Files:**
- Modify: `src/app/api/cron/scan/route.ts:69-74`

**Context:** The current cron/scan route always requires `CRON_SECRET` auth (line 72). If the env var isn't set, the route always returns 401. Change it to skip auth when `CRON_SECRET` is not configured, so you can test locally.

**Step 1: Update auth check**

In `src/app/api/cron/scan/route.ts`, replace lines 69-75:

```typescript
export async function GET(request: NextRequest) {
  // Auth check — skip if CRON_SECRET is not configured (allows local testing)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
```

**Step 2: Verify build passes**

Run: `PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run build`

**Step 3: Commit**

```bash
git add src/app/api/cron/scan/route.ts
git commit -m "fix: make CRON_SECRET auth optional for local testing

Skips auth check when CRON_SECRET env var is not set, allowing
manual scan triggers during development."
```

---

## Execution Summary

| Task | What | Files |
|------|------|-------|
| 1 | Web search tool in AI engine | `engine.ts`, `prompts.ts`, `cron/scan/route.ts`, `recommendations/route.ts` |
| 2 | Historical performance helper | `performance.ts`, `ai/index.ts`, `cron/scan/route.ts` |
| 3 | Stats API route | `api/stats/route.ts` |
| 4 | Bets API route | `api/bets/route.ts` |
| 5 | React Query provider | `providers.tsx`, `layout.tsx` |
| 6 | Live dashboard | `page.tsx` |
| 7 | Optional cron auth | `cron/scan/route.ts` |

7 tasks, 7 commits. After all tasks: build should pass, dashboard should show live data, scanner should use web search.
