// ---------------------------------------------------------------------------
// Prompt templates for the Kalshi AI Trader analysis engine.
// Each builder returns a complete prompt string ready to send to Claude.
// ---------------------------------------------------------------------------

// ---- Parameter types ------------------------------------------------------

export interface MarketAnalysisPromptParams {
  title: string;
  category: string;
  yes_price: number;
  volume_24h: number;
  close_time: string;
  orderbook_summary: string;
  external_context: string;
  strategy_rules: Record<string, unknown>;
  historical_performance: {
    category_win_rate: number | null;
    confidence_calibration: string;
  };
}

export interface HitMissAnalysisPromptParams {
  title: string;
  side: "YES" | "NO";
  entry_price: number;
  result: "WIN" | "LOSS";
  reasoning: string;
  confidence: number;
  resolution_context: string;
}

// ---- Builders -------------------------------------------------------------

/**
 * Builds the full prompt for Claude to analyze a Kalshi market and return a
 * structured recommendation (BUY_YES / BUY_NO / SKIP).
 */
export function buildMarketAnalysisPrompt(
  params: MarketAnalysisPromptParams,
): string {
  const {
    title,
    category,
    yes_price,
    volume_24h,
    close_time,
    orderbook_summary,
    external_context,
    strategy_rules,
    historical_performance,
  } = params;

  const impliedProbability = (yes_price * 100).toFixed(1);

  const historicalBlock = [
    historical_performance.category_win_rate !== null
      ? `- Category win rate: ${(historical_performance.category_win_rate * 100).toFixed(1)}%`
      : "- Category win rate: no data yet",
    `- Confidence calibration: ${historical_performance.confidence_calibration || "no data yet"}`,
  ].join("\n");

  return `You are a prediction market analyst. Analyze this market and recommend whether to bet YES or NO (or skip).

MARKET DATA:
- Title: ${title}
- Category: ${category}
- Current YES price: ${yes_price} (implied probability: ${impliedProbability}%)
- 24h volume: ${volume_24h}
- Close time: ${close_time}
- Orderbook depth: ${orderbook_summary}

EXTERNAL CONTEXT:
${external_context || "No additional external context available."}

CURRENT STRATEGY RULES:
${JSON.stringify(strategy_rules, null, 2)}

HISTORICAL PERFORMANCE ON SIMILAR MARKETS:
${historicalBlock}

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "recommendation": "BUY_YES" | "BUY_NO" | "SKIP",
  "confidence": 0-100,
  "suggested_size": <number of contracts>,
  "reasoning": "2-3 sentences on the edge",
  "key_risk": "what could go wrong",
  "data_sources": ["list of sources used"]
}`;
}

/**
 * Builds the full prompt for Claude to perform a hit/miss post-mortem on a
 * resolved bet, identifying patterns and proposing strategy updates.
 */
export function buildHitMissAnalysisPrompt(
  params: HitMissAnalysisPromptParams,
): string {
  const {
    title,
    side,
    entry_price,
    result,
    reasoning,
    confidence,
    resolution_context,
  } = params;

  return `A prediction market bet has resolved. Analyze why it hit or missed.

BET DETAILS:
- Market: ${title}
- My position: ${side} at ${entry_price}
- Outcome: ${result}
- Original reasoning: ${reasoning}
- Confidence at time of bet: ${confidence}

WHAT HAPPENED:
${resolution_context || "No additional resolution context available."}

Analyze and respond with ONLY valid JSON (no markdown, no code blocks):
{
  "thesis_correct": <boolean>,
  "reasoning": "full analysis of why the bet hit or missed",
  "patterns": ["identified patterns that can improve future bets"],
  "proposed_update": "specific actionable rule change or 'none'"
}`;
}
