// ---------------------------------------------------------------------------
// Historical Performance Helper
// Queries resolved bets joined with recommendations and markets to compute
// detailed performance breakdowns that feed into the AI analysis prompt.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface HistoricalPerformance {
  category_win_rate: number | null;
  confidence_calibration: string;
  recommendation_breakdown: string;
  side_performance: string;
}

/**
 * Computes detailed historical performance metrics for a given market category.
 *
 * Returns:
 * - Overall win rate for the category
 * - Confidence calibration (avg confidence on hits vs misses)
 * - BUY_YES vs BUY_NO win rate breakdown (critical — YES wins 4.5%, NO wins 83.8%)
 * - Side + price range performance
 */
export async function getHistoricalPerformance(
  category: string,
): Promise<HistoricalPerformance> {
  try {
    // --- Overall stats ---
    const overallResult = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total_resolved,
        COUNT(*) FILTER (WHERE b.outcome = 'hit')::int AS hits,
        COUNT(*) FILTER (WHERE b.outcome = 'miss')::int AS misses,
        ROUND(AVG(r.confidence) FILTER (WHERE b.outcome = 'hit'), 1) AS avg_confidence_hits,
        ROUND(AVG(r.confidence) FILTER (WHERE b.outcome = 'miss'), 1) AS avg_confidence_misses
      FROM bets b
      JOIN recommendations r ON r.id = b.recommendation_id
      JOIN markets m ON m.ticker = b.market_ticker
      WHERE b.outcome IS NOT NULL
        AND LOWER(m.category) = LOWER(${category})
    `);

    const row = (overallResult as unknown as Record<string, unknown>[])?.[0] as Record<string, unknown> | undefined;

    if (!row || Number(row.total_resolved ?? 0) < 3) {
      return {
        category_win_rate: null,
        confidence_calibration: `insufficient data (${Number(row?.total_resolved ?? 0)} resolved bets)`,
        recommendation_breakdown: "no data yet",
        side_performance: "no data yet",
      };
    }

    const totalResolved = Number(row.total_resolved);
    const hits = Number(row.hits);
    const winRate = hits / totalResolved;
    const avgConfHits = row.avg_confidence_hits != null ? Number(row.avg_confidence_hits) : null;
    const avgConfMisses = row.avg_confidence_misses != null ? Number(row.avg_confidence_misses) : null;

    // Confidence calibration
    const calParts: string[] = [`${totalResolved} resolved bets, ${(winRate * 100).toFixed(1)}% win rate`];
    if (avgConfHits !== null) calParts.push(`avg confidence on wins: ${avgConfHits}`);
    if (avgConfMisses !== null) calParts.push(`avg confidence on losses: ${avgConfMisses}`);

    // --- BUY_YES vs BUY_NO breakdown ---
    const recResult = await db.execute(sql`
      SELECT
        r.recommendation,
        COUNT(*)::int AS bets,
        COUNT(*) FILTER (WHERE b.outcome = 'hit')::int AS wins,
        ROUND(100.0 * COUNT(*) FILTER (WHERE b.outcome = 'hit') / NULLIF(COUNT(*), 0), 1) AS win_pct,
        ROUND(SUM(b.pnl::numeric), 2) AS total_pnl
      FROM bets b
      JOIN recommendations r ON r.id = b.recommendation_id
      JOIN markets m ON m.ticker = b.market_ticker
      WHERE b.outcome IS NOT NULL
        AND LOWER(m.category) = LOWER(${category})
      GROUP BY r.recommendation
      ORDER BY bets DESC
    `);

    const recRows = recResult as unknown as Record<string, unknown>[];
    const recParts = recRows.map((r) =>
      `${r.recommendation}: ${r.wins}/${r.bets} wins (${r.win_pct}%), P&L $${r.total_pnl}`
    );

    // --- Side + price range breakdown ---
    const sideResult = await db.execute(sql`
      SELECT
        b.side,
        CASE
          WHEN b.entry_price::numeric >= 0.80 THEN 'heavy_fav (>=80c)'
          WHEN b.entry_price::numeric >= 0.60 THEN 'favorite (60-79c)'
          WHEN b.entry_price::numeric >= 0.40 THEN 'coin_flip (40-59c)'
          WHEN b.entry_price::numeric >= 0.20 THEN 'underdog (20-39c)'
          ELSE 'longshot (<20c)'
        END AS price_range,
        COUNT(*)::int AS bets,
        COUNT(*) FILTER (WHERE b.outcome = 'hit')::int AS wins,
        ROUND(100.0 * COUNT(*) FILTER (WHERE b.outcome = 'hit') / NULLIF(COUNT(*), 0), 1) AS win_pct,
        ROUND(SUM(b.pnl::numeric), 2) AS total_pnl
      FROM bets b
      JOIN markets m ON m.ticker = b.market_ticker
      WHERE b.outcome IS NOT NULL
        AND LOWER(m.category) = LOWER(${category})
      GROUP BY b.side, price_range
      ORDER BY b.side, price_range
    `);

    const sideRows = sideResult as unknown as Record<string, unknown>[];
    const sideParts = sideRows.map((r) =>
      `${String(r.side).toUpperCase()} @ ${r.price_range}: ${r.wins}/${r.bets} (${r.win_pct}%), P&L $${r.total_pnl}`
    );

    return {
      category_win_rate: winRate,
      confidence_calibration: calParts.join(", "),
      recommendation_breakdown: recParts.join(" | ") || "no data yet",
      side_performance: sideParts.join("\n") || "no data yet",
    };
  } catch (error) {
    console.error("[Performance] Failed to fetch historical performance:", error);
    return {
      category_win_rate: null,
      confidence_calibration: "error fetching data",
      recommendation_breakdown: "error",
      side_performance: "error",
    };
  }
}
