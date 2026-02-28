import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { markets, recommendations, strategies } from "@/lib/db/schema";
import { kalshi } from "@/lib/kalshi";
import { aiEngine } from "@/lib/ai";

// ---------------------------------------------------------------------------
// GET /api/recommendations
// Fetch the latest recommendations from the database, joined with market
// titles for display.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Number(searchParams.get("limit") ?? "10");
    const minConfidence = searchParams.get("min_confidence")
      ? Number(searchParams.get("min_confidence"))
      : undefined;

    const conditions = [];
    if (minConfidence !== undefined) {
      conditions.push(gte(recommendations.confidence, minConfidence));
    }

    const rows = await db
      .select({
        id: recommendations.id,
        marketTicker: recommendations.marketTicker,
        marketTitle: markets.title,
        strategyId: recommendations.strategyId,
        recommendation: recommendations.recommendation,
        confidence: recommendations.confidence,
        suggestedSize: recommendations.suggestedSize,
        reasoning: recommendations.reasoning,
        keyRisk: recommendations.keyRisk,
        dataSources: recommendations.dataSources,
        externalContext: recommendations.externalContext,
        createdAt: recommendations.createdAt,
        notified: recommendations.notified,
      })
      .from(recommendations)
      .leftJoin(markets, eq(recommendations.marketTicker, markets.ticker))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(recommendations.createdAt))
      .limit(limit);

    return NextResponse.json({ recommendations: rows });
  } catch (error) {
    console.error("[API] GET /api/recommendations failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/recommendations
// Trigger an AI analysis on a specific market ticker. Fetches live market
// data from Kalshi, runs it through the AI engine, and stores the result.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticker } = body as { ticker: string };

    if (!ticker || typeof ticker !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'ticker' in request body" },
        { status: 400 },
      );
    }

    // Fetch live market data and orderbook from Kalshi
    const [marketResponse, orderbookResponse] = await Promise.all([
      kalshi.getMarket(ticker),
      kalshi.getOrderbook(ticker),
    ]);

    const market = marketResponse.market ?? marketResponse;

    // Fetch active strategy (if any) to include rules in the analysis
    const [activeStrategy] = await db
      .select()
      .from(strategies)
      .where(eq(strategies.status, "active"))
      .limit(1);

    // Build a summary of the orderbook for the prompt
    const orderbook = orderbookResponse.orderbook ?? orderbookResponse;
    const yesAsks = orderbook?.yes?.length ?? 0;
    const noAsks = orderbook?.no?.length ?? 0;
    const orderbookSummary = `${yesAsks} YES levels, ${noAsks} NO levels`;

    // Run AI analysis
    const analysis = await aiEngine.analyzeMarket({
      title: market.title ?? ticker,
      category: market.category ?? "unknown",
      yes_price: Number(market.yes_price ?? market.yes_bid ?? 0),
      volume_24h: Number(market.volume_24h ?? market.volume ?? 0),
      close_time: market.expected_expiration_time ?? market.expected_expiration ?? market.close_time ?? "",
      orderbook_summary: orderbookSummary,
      strategy_rules: (activeStrategy?.rules as Record<string, unknown>) ?? {},
      historical_performance: {
        category_win_rate: null,
        confidence_calibration: "no data yet",
      },
    });

    if (!analysis) {
      return NextResponse.json(
        { error: "AI analysis returned no result" },
        { status: 502 },
      );
    }

    // Ensure the market exists in our local database for the FK
    await db
      .insert(markets)
      .values({
        ticker,
        title: market.title ?? ticker,
        category: market.category ?? null,
        eventTicker: market.event_ticker ?? null,
        seriesTicker: market.series_ticker ?? null,
        status: market.status ?? "open",
        yesPrice: String(market.yes_price ?? market.yes_bid ?? "0"),
        volume24h: Number(market.volume_24h ?? market.volume ?? 0),
        closeTime: (market.expected_expiration_time ?? market.expected_expiration ?? market.close_time)
          ? new Date(market.expected_expiration_time ?? market.expected_expiration ?? market.close_time)
          : null,
        rawData: market,
        lastSynced: new Date(),
      })
      .onConflictDoUpdate({
        target: markets.ticker,
        set: {
          title: market.title ?? ticker,
          status: market.status ?? "open",
          yesPrice: String(market.yes_price ?? market.yes_bid ?? "0"),
          volume24h: Number(market.volume_24h ?? market.volume ?? 0),
          rawData: market,
          lastSynced: new Date(),
        },
      });

    // Store the recommendation
    const [recommendation] = await db
      .insert(recommendations)
      .values({
        marketTicker: ticker,
        strategyId: activeStrategy?.id ?? null,
        recommendation: analysis.recommendation,
        confidence: analysis.confidence,
        suggestedSize: analysis.suggested_size,
        reasoning: analysis.reasoning,
        keyRisk: analysis.key_risk,
        dataSources: analysis.data_sources,
      })
      .returning();

    return NextResponse.json({ recommendation }, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/recommendations failed:", error);
    return NextResponse.json(
      { error: "Failed to create recommendation" },
      { status: 500 },
    );
  }
}
