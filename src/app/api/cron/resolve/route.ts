import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { analyses, bets, markets, recommendations } from "@/lib/db/schema";
import { kalshi } from "@/lib/kalshi";
import { aiEngine } from "@/lib/ai";
import { sendPushNotification } from "@/lib/push";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/cron/resolve
// Vercel cron-compatible handler. Checks all open bets against Kalshi to see
// if markets have settled. Updates bet status, P&L, and outcome accordingly.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Auth check — skip if CRON_SECRET is not configured (allows local testing)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Fetch all open bets from DB
    const openBets = await db
      .select()
      .from(bets)
      .where(eq(bets.status, "open"));

    let resolved = 0;
    let won = 0;
    let lost = 0;

    for (const bet of openBets) {
      try {
        // Check the market status on Kalshi
        const marketResponse = await kalshi.getMarket(bet.marketTicker);
        const market = marketResponse.market ?? marketResponse;

        // Only process settled markets
        if (market.status !== "settled" && market.result === undefined) {
          continue;
        }

        // Determine if the bet won or lost
        // market.result is typically "yes" or "no"
        const marketResult = String(market.result ?? "").toLowerCase();

        // A bet wins if:
        //   - side is "yes" and market resolved "yes"
        //   - side is "no" and market resolved "no"
        const betWon = bet.side === marketResult;

        // Calculate exit price and P&L
        // If won: exit at 1.00 per contract. If lost: exit at 0.00.
        const exitPrice = betWon ? "1.0000" : "0.0000";
        const entryPrice = Number(bet.entryPrice);
        const contracts = bet.contracts;

        let pnl: string;
        if (betWon) {
          // Profit = (1 - entry_price) * contracts
          pnl = ((1 - entryPrice) * contracts).toFixed(4);
        } else {
          // Loss = entry_price * contracts (negative)
          pnl = (-(entryPrice * contracts)).toFixed(4);
        }

        // Update the bet record
        await db
          .update(bets)
          .set({
            status: betWon ? "won" : "lost",
            outcome: betWon ? "hit" : "miss",
            exitPrice,
            pnl,
            resolvedAt: new Date(),
          })
          .where(eq(bets.id, bet.id));

        // Send push notification for resolved bet
        await sendPushNotification(
          {
            title: `Bet ${betWon ? "Won" : "Lost"}: ${market.title ?? bet.marketTicker}`,
            body: `${betWon ? "+" : ""}$${Number(pnl).toFixed(2)} P&L`,
            url: "/bets",
          },
          { recommendationId: bet.recommendationId ?? bet.id, type: "bet_resolved" }
        );

        // Also update the local market record with settlement info
        await db
          .update(markets)
          .set({
            status: "settled",
            result: marketResult,
            settledAt: new Date(),
            lastSynced: new Date(),
          })
          .where(eq(markets.ticker, bet.marketTicker));

        resolved++;
        if (betWon) won++;
        else lost++;

        // Trigger AI post-mortem analysis (non-blocking — don't fail the cron if this errors)
        try {
          let originalReasoning = "No original reasoning recorded";
          let originalConfidence = 50;
          if (bet.recommendationId) {
            const [rec] = await db
              .select({ reasoning: recommendations.reasoning, confidence: recommendations.confidence })
              .from(recommendations)
              .where(eq(recommendations.id, bet.recommendationId))
              .limit(1);
            if (rec) {
              originalReasoning = rec.reasoning ?? originalReasoning;
              originalConfidence = rec.confidence;
            }
          }

          const analysis = await aiEngine.analyzeOutcome({
            title: market.title ?? bet.marketTicker,
            side: bet.side.toUpperCase() as "YES" | "NO",
            entry_price: entryPrice,
            result: betWon ? "WIN" : "LOSS",
            reasoning: originalReasoning,
            confidence: originalConfidence,
            resolution_context: "",
          });

          if (analysis) {
            await db.insert(analyses).values({
              betId: bet.id,
              thesisCorrect: analysis.thesis_correct,
              reasoning: analysis.reasoning,
              patterns: analysis.patterns,
              proposedUpdate: analysis.proposed_update,
            });
          }
        } catch (analysisError) {
          console.error(`[Cron/Resolve] Post-mortem failed for bet ${bet.id}:`, analysisError);
        }
      } catch (betError) {
        console.error(
          `[Cron/Resolve] Failed to resolve bet ${bet.id} (${bet.marketTicker}):`,
          betError,
        );
        // Continue processing remaining bets
      }
    }

    return NextResponse.json({
      success: true,
      openBetsChecked: openBets.length,
      resolved,
      won,
      lost,
    });
  } catch (error) {
    console.error("[Cron/Resolve] Resolve failed:", error);
    return NextResponse.json(
      { error: "Cron resolve failed" },
      { status: 500 },
    );
  }
}
