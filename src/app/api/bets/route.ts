import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bets, markets, recommendations } from "@/lib/db/schema";
import { eq, desc, and, SQL } from "drizzle-orm";
import { kalshi } from "@/lib/kalshi";

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
        recommendationId: bets.recommendationId,
        confidence: recommendations.confidence,
        reasoning: recommendations.reasoning,
        recommendation: recommendations.recommendation,
        keyRisk: recommendations.keyRisk,
      })
      .from(bets)
      .leftJoin(markets, eq(bets.marketTicker, markets.ticker))
      .leftJoin(recommendations, eq(bets.recommendationId, recommendations.id))
      .where(where)
      .orderBy(desc(bets.placedAt))
      .limit(limit);

    return NextResponse.json({ bets: result });
  } catch (error) {
    console.error("[Bets API] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch bets" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/bets — Place a new bet (paper or real)
// ---------------------------------------------------------------------------

interface PlaceBetBody {
  marketTicker: string;
  side: "yes" | "no";
  contracts: number;
  entryPrice: number;
  mode: "paper" | "real";
  recommendationId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PlaceBetBody;
    const { marketTicker, side, contracts, entryPrice, mode, recommendationId } = body;

    if (!marketTicker || !side || !contracts || !entryPrice || !mode) {
      return NextResponse.json(
        { error: "Missing required fields: marketTicker, side, contracts, entryPrice, mode" },
        { status: 400 },
      );
    }

    if (!["yes", "no"].includes(side)) {
      return NextResponse.json({ error: "side must be 'yes' or 'no'" }, { status: 400 });
    }

    if (!["paper", "real"].includes(mode)) {
      return NextResponse.json({ error: "mode must be 'paper' or 'real'" }, { status: 400 });
    }

    if (contracts < 1) {
      return NextResponse.json({ error: "contracts must be >= 1" }, { status: 400 });
    }

    const costPerContract = side === "yes" ? entryPrice : (1 - entryPrice);
    const totalCost = (costPerContract * contracts).toFixed(4);
    let kalshiOrderId: string | null = null;

    // For real mode, place order via Kalshi API
    if (mode === "real") {
      const orderResponse = await kalshi.placeOrder({
        ticker: marketTicker,
        action: "buy",
        side,
        type: "limit",
        count: contracts,
        yes_price: Math.round(entryPrice * 100), // Kalshi expects cents (1-99)
      });

      kalshiOrderId = orderResponse.order?.order_id ?? orderResponse.order_id ?? null;
    }

    // Insert bet into database
    const [bet] = await db
      .insert(bets)
      .values({
        marketTicker,
        recommendationId: recommendationId ?? null,
        mode,
        side,
        action: "buy",
        entryPrice: entryPrice.toFixed(4),
        contracts,
        totalCost,
        kalshiOrderId,
        status: "open",
      })
      .returning();

    return NextResponse.json({ bet }, { status: 201 });
  } catch (error) {
    console.error("[Bets API] POST failed:", error);
    return NextResponse.json(
      { error: "Failed to place bet" },
      { status: 500 },
    );
  }
}
