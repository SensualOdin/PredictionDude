import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { markets, recommendations, strategies } from "@/lib/db/schema";
import { kalshi } from "@/lib/kalshi";
import { aiEngine } from "@/lib/ai";

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

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all open markets from Kalshi
    const marketsResponse = await kalshi.getMarkets({
      status: "open",
      limit: 200,
    });

    const kalshiMarkets: Record<string, unknown>[] =
      marketsResponse.markets ?? [];

    // Fetch the active strategy
    const [activeStrategy] = await db
      .select()
      .from(strategies)
      .where(eq(strategies.status, "active"))
      .limit(1);

    const strategyRules: StrategyRules =
      (activeStrategy?.rules as StrategyRules) ?? {};

    // Filter markets against strategy rules
    const eligible = kalshiMarkets.filter((m) =>
      passesStrategyFilters(m, strategyRules),
    );

    let recommendationsCreated = 0;

    for (const market of eligible) {
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
          external_context: "",
          strategy_rules: strategyRules as Record<string, unknown>,
          historical_performance: {
            category_win_rate: null,
            confidence_calibration: "no data yet",
          },
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
        await db.insert(recommendations).values({
          marketTicker: ticker,
          strategyId: activeStrategy?.id ?? null,
          recommendation: analysis.recommendation,
          confidence: analysis.confidence,
          suggestedSize: analysis.suggested_size,
          reasoning: analysis.reasoning,
          keyRisk: analysis.key_risk,
          dataSources: analysis.data_sources,
        });

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
      recommendationsCreated,
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
