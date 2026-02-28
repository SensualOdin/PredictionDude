import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bets, markets, recommendations, settings, strategies } from "@/lib/db/schema";
import { kalshi } from "@/lib/kalshi";
import { aiEngine, getHistoricalPerformance } from "@/lib/ai";
import { sendPushNotification } from "@/lib/push";
import { categorizeMarket } from "@/lib/categorize";

// Kalshi event categories to scan (these are Kalshi's native categories)
const KALSHI_CATEGORIES = ["Sports"];

// Series tickers for mention-type markets (ephemeral, appear when events scheduled)
const MENTION_SERIES = [
  "KXTRUMPMENTION",
  "KXTRUMPMENTIONB",
  "KXTRUMPMENTIONC",
  "KXBIDENMENTION",
  "KXSOTUMENTION",
];

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Strategy filter helpers
// ---------------------------------------------------------------------------

interface StrategyRules {
  min_volume_24h?: number;
  min_yes_price?: number;
  max_yes_price?: number;
  categories?: string[];
  min_hours_until_close?: number;
}

function passesStrategyFilters(
  market: Record<string, unknown>,
  rules: StrategyRules,
): boolean {
  // Volume filter
  if (rules.min_volume_24h !== undefined) {
    const volume = Number(market.volume_24h ?? market.volume ?? 0);
    if (volume < rules.min_volume_24h) return false;
  }

  // Price range filter — Kalshi returns cents (0-99), strategy uses decimals (0-1)
  const yesPrice = Number(market.yes_bid ?? market.yes_ask ?? 0) / 100;

  if (rules.min_yes_price !== undefined && yesPrice < rules.min_yes_price) {
    return false;
  }
  if (rules.max_yes_price !== undefined && yesPrice > rules.max_yes_price) {
    return false;
  }

  // Category filter
  if (rules.categories && rules.categories.length > 0) {
    const category = String(market.category ?? "").toLowerCase();
    const allowed = rules.categories.map((c) => c.toLowerCase());
    if (!allowed.includes(category)) return false;
  }

  // Expiration filter -- market must close at least N hours from now
  if (rules.min_hours_until_close !== undefined) {
    const closeTime = market.expected_expiration_time ?? market.close_time;
    if (closeTime) {
      const hoursUntilClose =
        (new Date(closeTime as string).getTime() - Date.now()) / 3_600_000;
      if (hoursUntilClose < rules.min_hours_until_close) return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// GET /api/cron/scan
// Vercel cron-compatible handler. Scans open Kalshi markets, filters them
// against the active strategy, runs AI analysis, and stores recommendations.
// ---------------------------------------------------------------------------

// POST /api/cron/scan — Manual trigger (no auth required, user-initiated)
export async function POST() {
  return runScan();
}

export async function GET(request: NextRequest) {
  // Auth check — skip if CRON_SECRET is not configured (allows local testing)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return runScan();
}

async function runScan() {

  try {
    // ---- Fetch sports events via Kalshi's events API ----
    const allMarkets: Record<string, unknown>[] = [];

    for (const cat of KALSHI_CATEGORIES) {
      let cursor: string | undefined;
      // Paginate up to 3 pages per category (600 events max)
      for (let page = 0; page < 3; page++) {
        const eventsResp = await kalshi.getEvents({
          status: "open",
          limit: 200,
          category: cat,
          with_nested_markets: true,
          cursor,
        });
        const events: Record<string, unknown>[] = eventsResp.events ?? [];
        for (const event of events) {
          const eventMarkets = (event.markets ?? []) as Record<string, unknown>[];
          for (const m of eventMarkets) {
            m.category = categorizeMarket(
              String(m.title ?? ""),
              m.event_ticker as string | null,
            );
          }
          allMarkets.push(...eventMarkets);
        }
        cursor = eventsResp.cursor as string | undefined;
        if (!cursor || events.length < 200) break;
      }
    }

    // ---- Fetch mention-type series (ephemeral, may not always exist) ----
    for (const series of MENTION_SERIES) {
      try {
        const resp = await kalshi.getMarkets({ status: "open", limit: 100, series_ticker: series });
        const mks = (resp.markets ?? []) as Record<string, unknown>[];
        for (const m of mks) {
          m.category = "mentions";
        }
        allMarkets.push(...mks);
      } catch {
        // Series may not exist — that's fine
      }
    }

    // Drop junk: zero price AND zero volume
    const nonJunkMarkets = allMarkets.filter((m) => {
      const vol = Number(m.volume_24h ?? m.volume ?? 0);
      const price = Number(m.yes_bid ?? m.yes_ask ?? 0);
      return vol > 0 || price > 0;
    });

    // Only keep markets that resolve today or tomorrow in CST (America/Chicago).
    // Convert "now" to CST date parts, then compute end-of-tomorrow as a UTC timestamp.
    const cstNow = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); // "YYYY-MM-DD"
    const [cstYear, cstMonth, cstDay] = cstNow.split("-").map(Number);
    // End of tomorrow CST = start of day-after-tomorrow at 00:00 CST = 06:00 UTC (CST is UTC-6)
    const endOfTomorrowUTC = new Date(Date.UTC(cstYear, cstMonth - 1, cstDay + 2, 6, 0, 0, 0));

    const kalshiMarkets = nonJunkMarkets.filter((m) => {
      // Prefer expected_expiration_time (actual resolve) over close_time (safety deadline).
      // Kalshi sets close_time weeks out as a buffer, but expected_expiration_time
      // reflects when the market actually resolves (e.g. end of tonight's game).
      const resolveTime = m.expected_expiration_time ?? m.close_time;
      if (!resolveTime) return false;
      const resolveDate = new Date(resolveTime as string);
      return resolveDate.getTime() <= endOfTomorrowUTC.getTime();
    });

    // Fetch the active strategy
    const [activeStrategy] = await db
      .select()
      .from(strategies)
      .where(eq(strategies.status, "active"))
      .limit(1);

    // Read confidence threshold from settings
    const [userSettings] = await db.select().from(settings).limit(1);
    const minConfidenceThreshold = userSettings?.minConfidenceThreshold ?? 75;

    // Strategy rules may be nested under a "filters" key or flat — normalize
    const rawRules = (activeStrategy?.rules ?? {}) as Record<string, unknown>;
    const filters = (rawRules.filters ?? rawRules) as Record<string, unknown>;
    const strategyRules: StrategyRules = {
      min_volume_24h: filters.min_volume_24h as number | undefined,
      min_yes_price: filters.min_yes_price as number | undefined,
      max_yes_price: filters.max_yes_price as number | undefined,
      min_hours_until_close: (filters.min_hours_until_close ?? filters.min_time_to_expiration_hours) as number | undefined,
      categories: ((rawRules.categories as Record<string, unknown>)?.allowed as string[]) ?? undefined,
    };

    // Filter markets against strategy rules
    const eligible = kalshiMarkets.filter((m) =>
      passesStrategyFilters(m, strategyRules),
    );

    // Cap at 5 markets per scan to stay within Vercel's 300s function timeout
    // (~30s per AI analysis with web search = ~150s for 5 markets)
    const MAX_MARKETS_PER_SCAN = 5;
    const toAnalyze = eligible.slice(0, MAX_MARKETS_PER_SCAN);

    let recommendationsCreated = 0;
    let betsPlaced = 0;

    for (const market of toAnalyze) {
      const ticker = String(market.ticker);

      try {
        // Fetch orderbook for depth summary
        const orderbookResponse = await kalshi.getOrderbook(ticker);
        const orderbook = orderbookResponse.orderbook ?? orderbookResponse;
        const yesAsks = orderbook?.yes?.length ?? 0;
        const noAsks = orderbook?.no?.length ?? 0;
        const orderbookSummary = `${yesAsks} YES levels, ${noAsks} NO levels`;

        // Run AI analysis
        const analysis = await aiEngine.analyzeMarket({
          title: String(market.title ?? ticker),
          category: String(market.category ?? "unknown"),
          yes_price: Number(market.yes_bid ?? market.yes_ask ?? 0) / 100,
          volume_24h: Number(market.volume_24h ?? market.volume ?? 0),
          close_time: String(
            market.expected_expiration_time ?? market.close_time ?? "",
          ),
          orderbook_summary: orderbookSummary,
          strategy_rules: strategyRules as Record<string, unknown>,
          historical_performance: await getHistoricalPerformance(String(market.category ?? "unknown")),
        });

        if (!analysis) continue;

        // Upsert market into local DB
        await db
          .insert(markets)
          .values({
            ticker,
            title: String(market.title ?? ticker),
            category: (market.category as string) ?? null,
            eventTicker: (market.event_ticker as string) ?? null,
            seriesTicker: (market.series_ticker as string) ?? null,
            status: String(market.status ?? "open"),
            yesPrice: (Number(market.yes_bid ?? market.yes_ask ?? 0) / 100).toFixed(4),
            volume24h: Number(market.volume_24h ?? market.volume ?? 0),
            closeTime: (market.expected_expiration_time ?? market.close_time)
              ? new Date((market.expected_expiration_time ?? market.close_time) as string)
              : null,
            rawData: market,
            lastSynced: new Date(),
          })
          .onConflictDoUpdate({
            target: markets.ticker,
            set: {
              title: String(market.title ?? ticker),
              status: String(market.status ?? "open"),
              yesPrice: (Number(market.yes_bid ?? market.yes_ask ?? 0) / 100).toFixed(4),
              volume24h: Number(market.volume_24h ?? market.volume ?? 0),
              rawData: market,
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

        // Auto-place paper bet + send push if confidence meets threshold
        if (analysis.confidence >= minConfidenceThreshold && analysis.recommendation !== "SKIP") {
          const side = analysis.recommendation === "BUY_YES" ? "yes" : "no";
          const entryPrice = Number(market.yes_bid ?? market.yes_ask ?? 0) / 100;
          const contracts = analysis.suggested_size ?? 1;
          const totalCost = entryPrice * contracts;

          // Check bankroll before placing bet
          const currentBankroll = Number(userSettings?.currentBankroll ?? 0);
          if (totalCost > currentBankroll) {
            console.log(`[Cron/Scan] Skipping ${ticker}: cost $${totalCost.toFixed(2)} exceeds bankroll $${currentBankroll.toFixed(2)}`);
            continue;
          }

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

          // Deduct cost from bankroll
          await db.update(settings).set({
            currentBankroll: (currentBankroll - totalCost).toFixed(2),
          }).where(eq(settings.id, userSettings!.id));

          betsPlaced++;

          await sendPushNotification(
            {
              title: `Auto-bet: ${analysis.confidence}% confidence`,
              body: `${String(market.title)} — ${side.toUpperCase()} x${contracts}`,
              url: `/markets/${ticker}`,
            },
            { recommendationId: rec.id, type: "new_opportunity" }
          );
        }

        recommendationsCreated++;
      } catch (marketError) {
        console.error(
          `[Cron/Scan] Failed to process market ${ticker}:`,
          marketError,
        );
        // Continue processing remaining markets
      }
    }

    return NextResponse.json({
      success: true,
      marketsScanned: kalshiMarkets.length,
      marketsEligible: eligible.length,
      marketsAnalyzed: toAnalyze.length,
      recommendationsCreated,
      betsPlaced,
      strategyUsed: activeStrategy?.name ?? "default (no active strategy)",
    });
  } catch (error) {
    console.error("[Cron/Scan] Scan failed:", error);
    return NextResponse.json(
      { error: "Cron scan failed" },
      { status: 500 },
    );
  }
}
