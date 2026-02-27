import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
  jsonb,
  boolean,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Markets ────────────────────────────────────────────────────────────────────

export const markets = pgTable("markets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticker: text("ticker").unique().notNull(),
  eventTicker: text("event_ticker"),
  seriesTicker: text("series_ticker"),
  title: text("title").notNull(),
  category: text("category"),
  status: text("status").notNull().default("open"),
  yesPrice: numeric("yes_price", { precision: 6, scale: 4 }),
  volume24h: integer("volume_24h"),
  closeTime: timestamp("close_time", { withTimezone: true }),
  result: text("result"),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  rawData: jsonb("raw_data"),
  lastSynced: timestamp("last_synced", { withTimezone: true }).defaultNow(),
});

export const marketsRelations = relations(markets, ({ many }) => ({
  recommendations: many(recommendations),
  bets: many(bets),
}));

// ─── Strategies ─────────────────────────────────────────────────────────────────

export const strategies = pgTable("strategies", {
  id: uuid("id").primaryKey().defaultRandom(),
  version: serial("version"),
  name: text("name"),
  rules: jsonb("rules").notNull(),
  parentId: uuid("parent_id"),
  changeReason: text("change_reason"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const strategiesRelations = relations(strategies, ({ one, many }) => ({
  parent: one(strategies, {
    fields: [strategies.parentId],
    references: [strategies.id],
    relationName: "strategy_lineage",
  }),
  children: many(strategies, { relationName: "strategy_lineage" }),
  recommendations: many(recommendations),
}));

// ─── Recommendations ────────────────────────────────────────────────────────────

export const recommendations = pgTable("recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  marketTicker: text("market_ticker")
    .notNull()
    .references(() => markets.ticker),
  strategyId: uuid("strategy_id").references(() => strategies.id),
  recommendation: text("recommendation").notNull(), // 'BUY_YES' | 'BUY_NO' | 'SKIP'
  confidence: integer("confidence").notNull(),
  suggestedSize: integer("suggested_size"),
  reasoning: text("reasoning"),
  keyRisk: text("key_risk"),
  dataSources: text("data_sources").array(),
  externalContext: jsonb("external_context"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  notified: boolean("notified").default(false),
});

export const recommendationsRelations = relations(
  recommendations,
  ({ one, many }) => ({
    market: one(markets, {
      fields: [recommendations.marketTicker],
      references: [markets.ticker],
    }),
    strategy: one(strategies, {
      fields: [recommendations.strategyId],
      references: [strategies.id],
    }),
    bets: many(bets),
    alerts: many(alerts),
  })
);

// ─── Bets ───────────────────────────────────────────────────────────────────────

export const bets = pgTable("bets", {
  id: uuid("id").primaryKey().defaultRandom(),
  marketTicker: text("market_ticker")
    .notNull()
    .references(() => markets.ticker),
  recommendationId: uuid("recommendation_id").references(
    () => recommendations.id
  ),
  mode: text("mode").notNull(), // 'paper' | 'real'
  side: text("side").notNull(), // 'yes' | 'no'
  action: text("action").notNull(), // 'buy' | 'sell'
  entryPrice: numeric("entry_price", { precision: 6, scale: 4 }).notNull(),
  contracts: integer("contracts").notNull(),
  totalCost: numeric("total_cost", { precision: 10, scale: 4 }),
  kalshiOrderId: text("kalshi_order_id"),
  status: text("status").notNull().default("open"),
  outcome: text("outcome"), // 'hit' | 'miss'
  exitPrice: numeric("exit_price", { precision: 6, scale: 4 }),
  pnl: numeric("pnl", { precision: 10, scale: 4 }),
  placedAt: timestamp("placed_at", { withTimezone: true }).defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const betsRelations = relations(bets, ({ one, many }) => ({
  market: one(markets, {
    fields: [bets.marketTicker],
    references: [markets.ticker],
  }),
  recommendation: one(recommendations, {
    fields: [bets.recommendationId],
    references: [recommendations.id],
  }),
  analyses: many(analyses),
}));

// ─── Analyses ───────────────────────────────────────────────────────────────────

export const analyses = pgTable("analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  betId: uuid("bet_id")
    .notNull()
    .references(() => bets.id),
  thesisCorrect: boolean("thesis_correct"),
  reasoning: text("reasoning"),
  patterns: text("patterns").array(),
  proposedUpdate: text("proposed_update"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const analysesRelations = relations(analyses, ({ one }) => ({
  bet: one(bets, {
    fields: [analyses.betId],
    references: [bets.id],
  }),
}));

// ─── Alerts ─────────────────────────────────────────────────────────────────────

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  recommendationId: uuid("recommendation_id")
    .notNull()
    .references(() => recommendations.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
  clicked: boolean("clicked").default(false),
});

export const alertsRelations = relations(alerts, ({ one }) => ({
  recommendation: one(recommendations, {
    fields: [alerts.recommendationId],
    references: [recommendations.id],
  }),
}));

// ─── Settings ──────────────────────────────────────────────────────────────────

export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tradingMode: text("trading_mode").notNull().default("paper"),
  kalshiEnv: text("kalshi_env").notNull().default("demo"),
  minConfidenceThreshold: integer("min_confidence_threshold").notNull().default(75),
  scanIntervalHours: integer("scan_interval_hours").notNull().default(4),
  pushEnabled: boolean("push_enabled").notNull().default(false),
  pushSubscription: jsonb("push_subscription"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Type exports ───────────────────────────────────────────────────────────────

export type Market = typeof markets.$inferSelect;
export type NewMarket = typeof markets.$inferInsert;

export type Strategy = typeof strategies.$inferSelect;
export type NewStrategy = typeof strategies.$inferInsert;

export type Recommendation = typeof recommendations.$inferSelect;
export type NewRecommendation = typeof recommendations.$inferInsert;

export type Bet = typeof bets.$inferSelect;
export type NewBet = typeof bets.$inferInsert;

export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
