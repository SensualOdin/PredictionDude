import { eq, isNotNull, sql } from "drizzle-orm";
import { db } from "./index";
import { bets, settings } from "./schema";

/**
 * Computes current bankroll from first principles:
 *   startingBankroll + totalResolvedPnl - totalOpenBetCost
 *
 * This is the single source of truth — never rely on settings.currentBankroll
 * as it can drift from partial cron runs or crashes.
 */
export async function computeBankroll(): Promise<{
  bankroll: number;
  startingBankroll: number;
  totalPnl: number;
  openCost: number;
}> {
  const [userSettings] = await db.select().from(settings).limit(1);
  const startingBankroll = Number(userSettings?.startingBankroll ?? 1000);

  // Sum P&L from all resolved bets
  const pnlResult = await db
    .select({ total: sql<string>`COALESCE(SUM(pnl::numeric), 0)` })
    .from(bets)
    .where(isNotNull(bets.outcome));
  const totalPnl = Number(pnlResult[0]?.total ?? 0);

  // Sum cost of all currently open bets
  const openCostResult = await db
    .select({ total: sql<string>`COALESCE(SUM(total_cost::numeric), 0)` })
    .from(bets)
    .where(eq(bets.status, "open"));
  const openCost = Number(openCostResult[0]?.total ?? 0);

  const bankroll = startingBankroll + totalPnl - openCost;

  return { bankroll, startingBankroll, totalPnl, openCost };
}
