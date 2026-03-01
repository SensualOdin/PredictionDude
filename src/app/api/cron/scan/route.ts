import { NextRequest, NextResponse } from "next/server";
import { eq, sql, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { scanQueue, settings, strategies } from "@/lib/db/schema";
import { kalshi } from "@/lib/kalshi";
import { categorizeMarket } from "@/lib/categorize";

// Series tickers for game-specific sports markets (where the real action is)
const SPORTS_SERIES = [
  "KXNBAGAME",     // NBA game winners
  "KXNBASPREAD",   // NBA spreads
  "KXNBAOU",       // NBA over/unders
  "KXCBBML",       // College basketball moneylines
  "KXCBBGAME",     // College basketball game winners
  "KXCBBSPREAD",   // College basketball spreads
  "KXCBBOU",       // College basketball over/unders
  "KXNHLGAME",     // NHL game winners
  "KXNHLSPREAD",   // NHL spreads
  "KXNHLOU",       // NHL over/unders
  "KXNFLGAME",     // NFL game winners
  "KXNFLSPREAD",   // NFL spreads
  "KXNFLOU",       // NFL over/unders
  "KXMLBGAME",     // MLB game winners
  "KXMLBSPREAD",   // MLB spreads
];

// Series tickers for mention-type markets (ephemeral, appear when events scheduled)
const MENTION_SERIES = [
  "KXTRUMPMENTION",
  "KXTRUMPMENTIONB",
  "KXTRUMPMENTIONC",
  "KXBIDENMENTION",
  "KXSOTUMENTION",
];

export const maxDuration = 800;
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
// GET /api/cron/scan — Vercel cron handler
// POST /api/cron/scan — Manual trigger (no auth required, user-initiated)
//
// Fetches markets from Kalshi, filters them, and inserts eligible markets
// into the scan_queue for async AI analysis. No AI calls happen here.
// ---------------------------------------------------------------------------

export async function POST() {
  return runScan();
}

export async function GET(request: NextRequest) {
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
    // ---- Fetch sports markets from game-specific series ----
    const allMarkets: Record<string, unknown>[] = [];

    for (const series of SPORTS_SERIES) {
      try {
        const resp = await kalshi.getMarkets({ status: "open", limit: 200, series_ticker: series });
        const mks = (resp.markets ?? []) as Record<string, unknown>[];
        for (const m of mks) {
          m.category = categorizeMarket(
            String(m.title ?? ""),
            m.event_ticker as string | null,
          );
        }
        allMarkets.push(...mks);
      } catch {
        // Series may not exist for this sport/season — that's fine
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
    const cstNow = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    const [cstYear, cstMonth, cstDay] = cstNow.split("-").map(Number);
    const endOfTomorrowUTC = new Date(Date.UTC(cstYear, cstMonth - 1, cstDay + 2, 6, 0, 0, 0));

    const kalshiMarkets = nonJunkMarkets.filter((m) => {
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

    // Clean up old queue items (>24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.delete(scanQueue).where(lt(scanQueue.createdAt, oneDayAgo));

    // Bulk insert eligible markets into scan_queue
    const scanBatchId = `scan_${Date.now()}`;
    let queued = 0;

    for (const market of eligible) {
      const ticker = String(market.ticker);
      const yesPrice = Number(market.yes_bid ?? market.yes_ask ?? 0) / 100;
      const closeTime = market.expected_expiration_time ?? market.close_time;

      try {
        await db.insert(scanQueue).values({
          ticker,
          eventTicker: (market.event_ticker as string) ?? null,
          seriesTicker: (market.series_ticker as string) ?? null,
          title: String(market.title ?? ticker),
          category: (market.category as string) ?? null,
          yesPrice: yesPrice.toFixed(4),
          volume24h: Number(market.volume_24h ?? market.volume ?? 0),
          closeTime: closeTime ? new Date(closeTime as string) : null,
          rawData: market,
          status: "pending",
          scanBatchId,
        }).onConflictDoNothing();
        queued++;
      } catch (err) {
        console.error(`[Cron/Scan] Failed to queue ${ticker}:`, err);
      }
    }

    // Fire off analyze endpoint (non-blocking) for immediate processing
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      fetch(`${baseUrl}/api/cron/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {
        // Non-blocking — if it fails, the cron schedule will pick it up
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      marketsScanned: kalshiMarkets.length,
      marketsEligible: eligible.length,
      marketsQueued: queued,
      scanBatchId,
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
