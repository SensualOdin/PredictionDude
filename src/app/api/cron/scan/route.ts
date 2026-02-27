import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bets, markets, recommendations, settings, strategies } from "@/lib/db/schema";
import { kalshi } from "@/lib/kalshi";
import { aiEngine, getHistoricalPerformance } from "@/lib/ai";
import { sendPushNotification } from "@/lib/push";
import { categorizeMarket } from "@/lib/categorize";

// Only scan these categories — "mentions" (will X say/mention Y) and sports bets
const ALLOWED_CATEGORIES = new Set(["mentions", "sports"]);

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Strategy filter helpers
// ---------------------------------------------------------------------------

interface StrategyRules {
  min_volume_24h?: number;
  min_yes_price?: number;
  max_yes_price?: number;
  categories?: string[];
  min_hours_until_close?: number;
}

function passesStrategyFilters(
  market: Record<string, unknown>,
  rules: StrategyRules,
): boolean {
  // Volume filter
  if (rules.min_volume_24h !== undefined) {
    const volume = Number(market.volume_24h ?? market.volume ?? 0);
    if (volume < rules.min_volume_24h) return false;
  }

  // Price range filter (yes_price between min and max)
  const yesPrice = Number(market.yes_price ?? market.yes_bid ?? 0);

  if (rules.min_yes_price !== undefined && yesPrice < rules.min_yes_price) {
    return false;
  }
  if (rules.max_yes_price !== undefined && yesPrice > rules.max_yes_price) {
    return false;
  }

  // Category filter
  if (rules.categories && rules.categories.length > 0) {
    const category = String(market.category ?? "").toLowerCase();
    const allowed = rules.categories.map((c) => c.toLowerCase());
    if (!allowed.includes(category)) return false;
  }

  // Expiration filter -- market must close at least N hours from now
  if (rules.min_hours_until_close !== undefined) {
    const closeTime = market.close_time ?? market.expected_expiration;
    if (closeTime) {
      const hoursUntilClose =
        (new Date(closeTime as string).getTime() - Date.now()) / 3_600_000;
      if (hoursUntilClose < rules.min_hours_until_close) return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// GET /api/cron/scan
// Vercel cron-compatible handler. Scans open Kalshi markets, filters them
// against the active strategy, runs AI analysis, and stores recommendations.
// ---------------------------------------------------------------------------

// POST /api/cron/scan — Manual trigger (no auth required, user-initiated)
export async function POST() {
  return runScan();
}

export async function GET(request: NextRequest) {
  // Auth check — skip if CRON_SECRET is not configured (allows local testing)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return runScan();
}

async function runScan() {

  try {
    // Fetch all open markets from Kalshi
    const marketsResponse = await kalshi.getMarkets({
      status: "open",
      limit: 200,
    });

    const rawMarkets: Record<string, unknown>[] =
      marketsResponse.markets ?? [];

    // Categorize each market and keep only mentions + sports
    for (const m of rawMarkets) {
      m.category = categorizeMarket(
        String(m.title ?? ""),
        m.event_ticker as string | null,
      );
    }
    const kalshiMarkets = rawMarkets.filter((m) =>
      ALLOWED_CATEGORIES.has(String(m.category)),
    );

    // Fetch the active strategy
    const [activeStrategy] = await db
      .select()
      .from(strategies)
      .where(eq(strategies.status, "active"))
      .limit(1);

    // Read confidence threshold from settings
    const [userSettings] = await db.select().from(settings).limit(1);
    const minConfidenceThreshold = userSettings?.minConfidenceThreshold ?? 75;

    // Strategy rules may be nested under a "filters" key or flat — normalize
    const rawRules = (activeStrategy?.rules ?? {}) as Record<string, unknown>;
    const filters = (rawRules.filters ?? rawRules) as Record<string, unknown>;
    const strategyRules: StrategyRules = {
      min_volume_24h: filters.min_volume_24h as number | undefined,
      min_yes_price: filters.min_yes_price as number | undefined,
      max_yes_price: filters.max_yes_price as number | undefined,
      min_hours_until_close: (filters.min_hours_until_close ?? filters.min_time_to_expiration_hours) as number | undefined,
      categories: ((rawRules.categories as Record<string, unknown>)?.allowed as string[]) ?? undefined,
    };

    // Filter markets against strategy rules
    const eligible = kalshiMarkets.filter((m) =>
      passesStrategyFilters(m, strategyRules),
    );

    // Cap at 5 markets per scan to stay within Vercel's 300s function timeout
    // (~30s per AI analysis with web search = ~150s for 5 markets)
    const MAX_MARKETS_PER_SCAN = 5;
    const toAnalyze = eligible.slice(0, MAX_MARKETS_PER_SCAN);

    let recommendationsCreated = 0;
    let betsPlaced = 0;

    for (const market of toAnalyze) {
      const ticker = String(market.ticker);

      try {
        // Fetch orderbook for depth summary
        const orderbookResponse = await kalshi.getOrderbook(ticker);
        const orderbook = orderbookResponse.orderbook ?? orderbookResponse;
        const yesAsks = orderbook?.yes?.length ?? 0;
        const noAsks = orderbook?.no?.length ?? 0;
        const orderbookSummary = `${yesAsks} YES levels, ${noAsks} NO levels`;

        // Run AI analysis
        const analysis = await aiEngine.analyzeMarket({
          title: String(market.title ?? ticker),
          category: String(market.category ?? "unknown"),
          yes_price: Number(market.yes_price ?? market.yes_bid ?? 0),
          volume_24h: Number(market.volume_24h ?? market.volume ?? 0),
          close_time: String(
            market.close_time ?? market.expected_expiration ?? "",
          ),
          orderbook_summary: orderbookSummary,
          strategy_rules: strategyRules as Record<string, unknown>,
          historical_performance: await getHistoricalPerformance(String(market.category ?? "unknown")),
        });

        if (!analysis) continue;

        // Upsert market into local DB
        await db
          .insert(markets)
          .values({
            ticker,
            title: String(market.title ?? ticker),
            category: (market.category as string) ?? null,
            eventTicker: (market.event_ticker as string) ?? null,
            seriesTicker: (market.series_ticker as string) ?? null,
            status: String(market.status ?? "open"),
            yesPrice: String(market.yes_price ?? market.yes_bid ?? "0"),
            volume24h: Number(market.volume_24h ?? market.volume ?? 0),
            closeTime: market.close_time
              ? new Date(market.close_time as string)
              : null,
            rawData: market,
            lastSynced: new Date(),
          })
          .onConflictDoUpdate({
            target: markets.ticker,
            set: {
              title: String(market.title ?? ticker),
              status: String(market.status ?? "open"),
              yesPrice: String(market.yes_price ?? market.yes_bid ?? "0"),
              volume24h: Number(market.volume_24h ?? market.volume ?? 0),
              rawData: market,
              lastSynced: new Date(),
            },
          });

        // Store the recommendation
        const [rec] = await db.insert(recommendations).values({
          marketTicker: ticker,
          strategyId: activeStrategy?.id ?? null,
          recommendation: analysis.recommendation,
          confidence: analysis.confidence,
          suggestedSize: analysis.suggested_size,
          reasoning: analysis.reasoning,
          keyRisk: analysis.key_risk,
          dataSources: analysis.data_sources,
        }).returning();

        // Auto-place paper bet + send push if confidence meets threshold
        if (analysis.confidence >= minConfidenceThreshold && analysis.recommendation !== "SKIP") {
          const side = analysis.recommendation === "BUY_YES" ? "yes" : "no";
          const entryPrice = Number(market.yes_price ?? market.yes_bid ?? 0);
          const contracts = analysis.suggested_size ?? 1;

          await db.insert(bets).values({
            marketTicker: ticker,
            recommendationId: rec.id,
            mode: "paper",
            side,
            action: "buy",
            entryPrice: entryPrice.toFixed(4),
            contracts,
            totalCost: (entryPrice * contracts).toFixed(4),
            status: "open",
          });

          betsPlaced++;

          await sendPushNotification(
            {
              title: `Auto-bet: ${analysis.confidence}% confidence`,
              body: `${String(market.title)} — ${side.toUpperCase()} x${contracts}`,
              url: `/markets/${ticker}`,
            },
            { recommendationId: rec.id, type: "new_opportunity" }
          );
        }

        recommendationsCreated++;
      } catch (marketError) {
        console.error(
          `[Cron/Scan] Failed to process market ${ticker}:`,
          marketError,
        );
        // Continue processing remaining markets
      }
    }

    return NextResponse.json({
      success: true,
      marketsScanned: kalshiMarkets.length,
      marketsEligible: eligible.length,
      marketsAnalyzed: toAnalyze.length,
      recommendationsCreated,
      betsPlaced,
      strategyUsed: activeStrategy?.name ?? "default (no active strategy)",
    });
  } catch (error) {
    console.error("[Cron/Scan] Scan failed:", error);
    return NextResponse.json(
      { error: "Cron scan failed" },
      { status: 500 },
    );
  }
}
