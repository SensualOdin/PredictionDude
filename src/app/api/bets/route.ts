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
