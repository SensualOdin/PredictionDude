import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bets, markets, recommendations, scanQueue, settings, strategies } from "@/lib/db/schema";
import { kalshi } from "@/lib/kalshi";
import { aiEngine, getHistoricalPerformance } from "@/lib/ai";
import { sendPushNotification } from "@/lib/push";
import { computeBankroll } from "@/lib/db/bankroll";

export const maxDuration = 800;
export const dynamic = "force-dynamic";

const BATCH_SIZE = 5; // Parallel AI calls per batch

// ---------------------------------------------------------------------------
// GET /api/cron/analyze — Vercel cron handler
// POST /api/cron/analyze — Called by scan cron or manually
//
// Processes pending scan_queue items: fetches orderbooks, runs AI analysis,
// stores recommendations, and auto-places bets above threshold.
// ---------------------------------------------------------------------------

export async function POST() {
  return runAnalyze();
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return runAnalyze();
}

async function runAnalyze() {
  try {
    // Claim pending queue items using FOR UPDATE SKIP LOCKED
    // Also re-claim stale items (processing > 5 min ago)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    const pendingItems = await db.execute(sql`
      UPDATE scan_queue
      SET status = 'processing', processing_started_at = now()
      WHERE id IN (
        SELECT id FROM scan_queue
        WHERE status = 'pending'
           OR (status = 'processing' AND processing_started_at < ${fiveMinAgo.toISOString()}::timestamptz)
        ORDER BY created_at ASC
        LIMIT 40
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);

    if (!pendingItems || pendingItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending items in queue",
        processed: 0,
      });
    }

    // Load strategy + settings once
    const [activeStrategy] = await db
      .select()
      .from(strategies)
      .where(eq(strategies.status, "active"))
      .limit(1);

    const [userSettings] = await db.select().from(settings).limit(1);
    const minConfidenceThreshold = userSettings?.minConfidenceThreshold ?? 75;
    let bankroll = (await computeBankroll()).bankroll;

    // Strategy rules
    const rawRules = (activeStrategy?.rules ?? {}) as Record<string, unknown>;
    const filters = (rawRules.filters ?? rawRules) as Record<string, unknown>;
    const strategyRules = {
      min_volume_24h: filters.min_volume_24h as number | undefined,
      min_yes_price: filters.min_yes_price as number | undefined,
      max_yes_price: filters.max_yes_price as number | undefined,
      min_hours_until_close: (filters.min_hours_until_close ?? filters.min_time_to_expiration_hours) as number | undefined,
      categories: ((rawRules.categories as Record<string, unknown>)?.allowed as string[]) ?? undefined,
    };

    let processed = 0;
    let recommendationsCreated = 0;
    let betsPlaced = 0;
    let failed = 0;

    // Process in batches of BATCH_SIZE
    const items = Array.from(pendingItems) as Record<string, unknown>[];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const ticker = String(item.ticker);
          const rawData = (item.raw_data ?? {}) as Record<string, unknown>;
          const itemId = String(item.id);

          try {
            // Fetch orderbook for depth summary
            const orderbookResponse = await kalshi.getOrderbook(ticker);
            const orderbook = orderbookResponse.orderbook ?? orderbookResponse;
            const yesAsks = orderbook?.yes?.length ?? 0;
            const noAsks = orderbook?.no?.length ?? 0;
            const orderbookSummary = `${yesAsks} YES levels, ${noAsks} NO levels`;

            const yesPrice = Number(item.yes_price ?? 0);
            const category = String(item.category ?? "unknown");

            // Run AI analysis
            const analysis = await aiEngine.analyzeMarket({
              title: String(item.title ?? ticker),
              category,
              yes_price: yesPrice,
              volume_24h: Number(item.volume_24h ?? 0),
              close_time: item.close_time ? String(item.close_time) : "",
              orderbook_summary: orderbookSummary,
              strategy_rules: strategyRules as Record<string, unknown>,
              historical_performance: await getHistoricalPerformance(category),
            });

            if (!analysis) {
              // Mark completed with no recommendation
              await db
                .update(scanQueue)
                .set({ status: "completed", completedAt: new Date() })
                .where(eq(scanQueue.id, itemId));
              return { ticker, status: "skipped" };
            }

            // Upsert market into local DB
            await db
              .insert(markets)
              .values({
                ticker,
                title: String(item.title ?? ticker),
                category: (item.category as string) ?? null,
                eventTicker: (item.event_ticker as string) ?? null,
                seriesTicker: (item.series_ticker as string) ?? null,
                status: "open",
                yesPrice: yesPrice.toFixed(4),
                volume24h: Number(item.volume_24h ?? 0),
                closeTime: item.close_time ? new Date(item.close_time as string) : null,
                rawData: rawData,
                lastSynced: new Date(),
              })
              .onConflictDoUpdate({
                target: markets.ticker,
                set: {
                  title: String(item.title ?? ticker),
                  status: "open",
                  yesPrice: yesPrice.toFixed(4),
                  volume24h: Number(item.volume_24h ?? 0),
                  rawData: rawData,
                  lastSynced: new Date(),
                },
              });

            // Store the recommendation
            const [rec] = await db.insert(recommendations).values({
              marketTicker: ticker,
              strategyId: activeStrategy?.id ?? null,
              recommendation: analysis.recommendation,
              confidence: analysis.confidence,
              suggestedSize: analysis.suggested_size,
              reasoning: analysis.reasoning,
              keyRisk: analysis.key_risk,
              dataSources: analysis.data_sources,
            }).returning();

            recommendationsCreated++;

            // Auto-place paper bet if confidence meets threshold
            if (analysis.confidence >= minConfidenceThreshold && analysis.recommendation !== "SKIP") {
              const side = analysis.recommendation === "BUY_YES" ? "yes" : "no";
              const entryPrice = yesPrice;
              const contracts = analysis.suggested_size ?? 1;
              const costPerContract = side === "yes" ? entryPrice : (1 - entryPrice);
              const totalCost = costPerContract * contracts;

              if (totalCost <= bankroll) {
                await db.insert(bets).values({
                  marketTicker: ticker,
                  recommendationId: rec.id,
                  mode: "paper",
                  side,
                  action: "buy",
                  entryPrice: entryPrice.toFixed(4),
                  contracts,
                  totalCost: totalCost.toFixed(4),
                  status: "open",
                });

                bankroll -= totalCost;
                betsPlaced++;

                await sendPushNotification(
                  {
                    title: `Auto-bet: ${analysis.confidence}% confidence`,
                    body: `${String(item.title)} — ${side.toUpperCase()} x${contracts}`,
                    url: `/markets/${ticker}`,
                  },
                  { recommendationId: rec.id, type: "new_opportunity" }
                );
              } else {
                console.log(`[Cron/Analyze] Skipping ${ticker}: cost $${totalCost.toFixed(2)} exceeds bankroll $${bankroll.toFixed(2)}`);
              }
            }

            // Mark queue item completed
            await db
              .update(scanQueue)
              .set({
                status: "completed",
                completedAt: new Date(),
                recommendationId: rec.id,
              })
              .where(eq(scanQueue.id, itemId));

            return { ticker, status: "analyzed", confidence: analysis.confidence };
          } catch (err) {
            console.error(`[Cron/Analyze] Failed to process ${ticker}:`, err);

            // Mark queue item as failed
            await db
              .update(scanQueue)
              .set({
                status: "failed",
                completedAt: new Date(),
                errorMessage: err instanceof Error ? err.message : String(err),
              })
              .where(eq(scanQueue.id, itemId));

            throw err;
          }
        })
      );

      for (const result of results) {
        processed++;
        if (result.status === "rejected") {
          failed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      recommendationsCreated,
      betsPlaced,
      failed,
      bankroll: bankroll.toFixed(2),
    });
  } catch (error) {
    console.error("[Cron/Analyze] Analyze failed:", error);
    return NextResponse.json(
      { error: "Cron analyze failed" },
      { status: 500 },
    );
  }
}
