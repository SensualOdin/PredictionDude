// ---------------------------------------------------------------------------
// Historical Performance Helper
// Queries resolved bets joined with recommendations and markets to compute
// per-category win rates and confidence calibration stats.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface HistoricalPerformance {
  category_win_rate: number | null;
  confidence_calibration: string;
}

/**
 * Computes historical performance metrics for a given market category.
 *
 * Joins bets -> recommendations -> markets to find all resolved bets in the
 * specified category, then calculates:
 * - Win rate: hits / total resolved bets
 * - Confidence calibration: average confidence of hits vs misses
 *
 * Returns a fallback "insufficient data" message when fewer than 3 resolved
 * bets exist for the category.
 */
export async function getHistoricalPerformance(
  category: string,
): Promise<HistoricalPerformance> {
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total_resolved,
        COUNT(*) FILTER (WHERE b.outcome = 'hit')::int AS hits,
        COUNT(*) FILTER (WHERE b.outcome = 'miss')::int AS misses,
        ROUND(AVG(r.confidence) FILTER (WHERE b.outcome = 'hit'), 1) AS avg_confidence_hits,
        ROUND(AVG(r.confidence) FILTER (WHERE b.outcome = 'miss'), 1) AS avg_confidence_misses,
        ROUND(AVG(r.confidence), 1) AS avg_confidence_overall
      FROM bets b
      JOIN recommendations r ON r.id = b.recommendation_id
      JOIN markets m ON m.ticker = b.market_ticker
      WHERE b.outcome IS NOT NULL
        AND LOWER(m.category) = LOWER(${category})
    `);

    const row = (result as unknown as Record<string, unknown>[])?.[0] as Record<string, unknown> | undefined;

    if (!row) {
      return {
        category_win_rate: null,
        confidence_calibration: "no data yet",
      };
    }

    const totalResolved = Number(row.total_resolved ?? 0);
    const hits = Number(row.hits ?? 0);
    const avgConfidenceHits = row.avg_confidence_hits != null ? Number(row.avg_confidence_hits) : null;
    const avgConfidenceMisses = row.avg_confidence_misses != null ? Number(row.avg_confidence_misses) : null;

    // Require at least 3 resolved bets for meaningful stats
    if (totalResolved < 3) {
      return {
        category_win_rate: null,
        confidence_calibration: `insufficient data (${totalResolved} resolved bet${totalResolved === 1 ? "" : "s"} in category)`,
      };
    }

    const winRate = hits / totalResolved;

    // Build calibration summary
    const calibrationParts: string[] = [];
    calibrationParts.push(`${totalResolved} resolved bets`);

    if (avgConfidenceHits !== null) {
      calibrationParts.push(`avg confidence on hits: ${avgConfidenceHits}`);
    }
    if (avgConfidenceMisses !== null) {
      calibrationParts.push(`avg confidence on misses: ${avgConfidenceMisses}`);
    }

    return {
      category_win_rate: winRate,
      confidence_calibration: calibrationParts.join(", "),
    };
  } catch (error) {
    console.error("[Performance] Failed to fetch historical performance:", error);
    return {
      category_win_rate: null,
      confidence_calibration: "error fetching data",
    };
  }
}
