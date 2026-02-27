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

    // Current streak
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
