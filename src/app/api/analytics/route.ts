import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/analytics — Aggregated chart data for the analytics dashboard
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    // 1. Win Rate Over Time (weekly buckets)
    const winRateOverTime = await db.execute(sql`
      SELECT
        date_trunc('week', resolved_at)::date AS week,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE outcome = 'hit')::int AS hits,
        ROUND(
          COUNT(*) FILTER (WHERE outcome = 'hit')::numeric / NULLIF(COUNT(*), 0),
          3
        ) AS win_rate
      FROM bets
      WHERE outcome IS NOT NULL AND resolved_at IS NOT NULL
      GROUP BY date_trunc('week', resolved_at)
      ORDER BY week ASC
    `);

    // 2. Accuracy by Category
    const accuracyByCategory = await db.execute(sql`
      SELECT
        COALESCE(LOWER(m.category), 'unknown') AS category,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE b.outcome = 'hit')::int AS hits,
        ROUND(
          COUNT(*) FILTER (WHERE b.outcome = 'hit')::numeric / NULLIF(COUNT(*), 0),
          3
        ) AS win_rate
      FROM bets b
      JOIN markets m ON m.ticker = b.market_ticker
      WHERE b.outcome IS NOT NULL
      GROUP BY LOWER(m.category)
      ORDER BY total DESC
    `);

    // 3. Confidence Calibration (buckets: 50-59, 60-69, 70-79, 80-89, 90-100)
    const confidenceCalibration = await db.execute(sql`
      SELECT
        CASE
          WHEN r.confidence >= 90 THEN '90-100'
          WHEN r.confidence >= 80 THEN '80-89'
          WHEN r.confidence >= 70 THEN '70-79'
          WHEN r.confidence >= 60 THEN '60-69'
          ELSE '50-59'
        END AS bucket,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE b.outcome = 'hit')::int AS hits,
        ROUND(
          COUNT(*) FILTER (WHERE b.outcome = 'hit')::numeric / NULLIF(COUNT(*), 0),
          3
        ) AS actual_rate,
        ROUND(AVG(r.confidence), 1) AS avg_confidence
      FROM bets b
      JOIN recommendations r ON r.id = b.recommendation_id
      WHERE b.outcome IS NOT NULL
      GROUP BY
        CASE
          WHEN r.confidence >= 90 THEN '90-100'
          WHEN r.confidence >= 80 THEN '80-89'
          WHEN r.confidence >= 70 THEN '70-79'
          WHEN r.confidence >= 60 THEN '60-69'
          ELSE '50-59'
        END
      ORDER BY bucket ASC
    `);

    // 4. Cumulative P&L Curve (daily)
    const pnlCurve = await db.execute(sql`
      SELECT
        resolved_at::date AS day,
        SUM(COALESCE(pnl::numeric, 0)) AS daily_pnl,
        SUM(SUM(COALESCE(pnl::numeric, 0))) OVER (ORDER BY resolved_at::date) AS cumulative_pnl
      FROM bets
      WHERE outcome IS NOT NULL AND resolved_at IS NOT NULL
      GROUP BY resolved_at::date
      ORDER BY day ASC
    `);

    return NextResponse.json({
      winRateOverTime: winRateOverTime as unknown as Record<string, unknown>[],
      accuracyByCategory: accuracyByCategory as unknown as Record<string, unknown>[],
      confidenceCalibration: confidenceCalibration as unknown as Record<string, unknown>[],
      pnlCurve: pnlCurve as unknown as Record<string, unknown>[],
    });
  } catch (error) {
    console.error("[Analytics API] Failed:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
