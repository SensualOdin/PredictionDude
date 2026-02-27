import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyses, bets, recommendations, markets } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { aiEngine } from "@/lib/ai";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/analyses — Fetch analyses with bet/market context
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Number(searchParams.get("limit") ?? 20);

    const rows = await db
      .select({
        id: analyses.id,
        betId: analyses.betId,
        thesisCorrect: analyses.thesisCorrect,
        reasoning: analyses.reasoning,
        patterns: analyses.patterns,
        proposedUpdate: analyses.proposedUpdate,
        createdAt: analyses.createdAt,
        marketTicker: bets.marketTicker,
        marketTitle: markets.title,
        betSide: bets.side,
        betOutcome: bets.outcome,
        betPnl: bets.pnl,
      })
      .from(analyses)
      .leftJoin(bets, eq(analyses.betId, bets.id))
      .leftJoin(markets, eq(bets.marketTicker, markets.ticker))
      .orderBy(desc(analyses.createdAt))
      .limit(limit);

    return NextResponse.json({ analyses: rows });
  } catch (error) {
    console.error("[Analyses API] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch analyses" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/analyses — Trigger AI post-mortem on a resolved bet
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { betId } = body as { betId: string };

    if (!betId) {
      return NextResponse.json({ error: "betId is required" }, { status: 400 });
    }

    // Fetch the bet with its recommendation reasoning
    const [bet] = await db
      .select({
        id: bets.id,
        marketTicker: bets.marketTicker,
        side: bets.side,
        entryPrice: bets.entryPrice,
        outcome: bets.outcome,
        status: bets.status,
        recommendationId: bets.recommendationId,
      })
      .from(bets)
      .where(eq(bets.id, betId))
      .limit(1);

    if (!bet) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }

    if (!bet.outcome) {
      return NextResponse.json({ error: "Bet has not been resolved yet" }, { status: 400 });
    }

    // Get the market title
    const [market] = await db
      .select({ title: markets.title })
      .from(markets)
      .where(eq(markets.ticker, bet.marketTicker))
      .limit(1);

    // Get original reasoning from the recommendation (if linked)
    let originalReasoning = "No original reasoning recorded";
    let originalConfidence = 50;
    if (bet.recommendationId) {
      const [rec] = await db
        .select({
          reasoning: recommendations.reasoning,
          confidence: recommendations.confidence,
        })
        .from(recommendations)
        .where(eq(recommendations.id, bet.recommendationId))
        .limit(1);

      if (rec) {
        originalReasoning = rec.reasoning ?? originalReasoning;
        originalConfidence = rec.confidence;
      }
    }

    // Run AI analysis
    const analysis = await aiEngine.analyzeOutcome({
      title: market?.title ?? bet.marketTicker,
      side: bet.side.toUpperCase() as "YES" | "NO",
      entry_price: Number(bet.entryPrice),
      result: bet.outcome === "hit" ? "WIN" : "LOSS",
      reasoning: originalReasoning,
      confidence: originalConfidence,
      resolution_context: "",
    });

    if (!analysis) {
      return NextResponse.json({ error: "AI analysis failed" }, { status: 502 });
    }

    // Store the analysis
    const [stored] = await db
      .insert(analyses)
      .values({
        betId,
        thesisCorrect: analysis.thesis_correct,
        reasoning: analysis.reasoning,
        patterns: analysis.patterns,
        proposedUpdate: analysis.proposed_update,
      })
      .returning();

    return NextResponse.json({ analysis: stored }, { status: 201 });
  } catch (error) {
    console.error("[Analyses API] POST failed:", error);
    return NextResponse.json({ error: "Failed to create analysis" }, { status: 500 });
  }
}
