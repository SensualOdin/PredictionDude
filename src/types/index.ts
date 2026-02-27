// ============================================================
// Kalshi API Types
// ============================================================

export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  series_ticker: string;
  title: string;
  category: string;
  status: "open" | "closed" | "settled";
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume_24h: number;
  open_interest: number;
  close_time: string;
  result: "yes" | "no" | "" | null;
  market_type: "binary" | "scalar";
}

export interface KalshiOrderbook {
  yes: { price: number; quantity: number }[];
  no: { price: number; quantity: number }[];
}

export interface KalshiOrder {
  order_id: string;
  ticker: string;
  action: "buy" | "sell";
  side: "yes" | "no";
  type: "limit" | "market";
  status: string;
  yes_price: number;
  count: number;
  remaining_count: number;
  created_time: string;
}

export interface KalshiPosition {
  ticker: string;
  position: number;
  market_exposure: number;
  realized_pnl: number;
  fees_paid: number;
}

export interface KalshiFill {
  fill_id: string;
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  count: number;
  yes_price: number;
  is_taker: boolean;
  fee_cost: number;
  created_time: string;
}

// ============================================================
// AI Types
// ============================================================

export type Recommendation = "BUY_YES" | "BUY_NO" | "SKIP";

export interface AIAnalysis {
  recommendation: Recommendation;
  confidence: number;
  suggested_size: number;
  reasoning: string;
  key_risk: string;
  data_sources: string[];
}

export interface HitMissAnalysis {
  thesis_correct: boolean;
  reasoning: string;
  patterns: string[];
  proposed_update: string;
}

// ============================================================
// App Types
// ============================================================

export type TradingMode = "paper" | "real";
export type BetStatus = "open" | "won" | "lost" | "sold";
export type BetOutcome = "hit" | "miss" | null;

export interface StrategyRules {
  categories: {
    allowed: string[];
    blocked: string[];
    weights: Record<string, number>;
  };
  filters: {
    min_volume_24h: number;
    min_time_to_expiration_hours: number;
    max_yes_price: number;
    min_yes_price: number;
  };
  position_sizing: {
    default_contracts: number;
    max_contracts: number;
    confidence_scaling: boolean;
    scale_map: Record<string, number>;
  };
  notifications: {
    min_confidence_to_alert: number;
  };
}

// ============================================================
// Dashboard Stats
// ============================================================

export interface DashboardStats {
  total_bets: number;
  win_rate: number;
  total_pnl: number;
  active_bets: number;
  streak: number;
  streak_type: "W" | "L" | null;
}
