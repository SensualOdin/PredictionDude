// ---------------------------------------------------------------------------
// Prompt templates for the Kalshi AI Trader analysis engine.
// Each builder returns a complete prompt string ready to send to Kimi K2.5.
// ---------------------------------------------------------------------------

// ---- Parameter types ------------------------------------------------------

export interface MarketAnalysisPromptParams {
  title: string;
  category: string;
  yes_price: number;
  volume_24h: number;
  close_time: string;
  orderbook_summary: string;
  strategy_rules: Record<string, unknown>;
  historical_performance: {
    category_win_rate: number | null;
    confidence_calibration: string;
    recommendation_breakdown: string;
    side_performance: string;
  };
  // New fields for market type awareness
  market_type: "spread" | "game_winner" | "mention" | "unknown";
  contract_team: string | null; // e.g. "UTA" for a Utah contract
  spread_points: number | null; // e.g. 16.5 for "wins by over 16.5"
  ticker: string;
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
 * Builds the full prompt for the AI to analyze a Kalshi market and return a
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
    strategy_rules,
    historical_performance,
    market_type,
    contract_team,
    spread_points,
    ticker,
  } = params;

  const impliedProbability = (yes_price * 100).toFixed(1);

  // Build the historical performance block — this is the most important context
  const histBlock = buildHistoricalBlock(historical_performance);

  // Market-type-specific explanation
  const marketExplanation = buildMarketExplanation(
    market_type, title, contract_team, spread_points, yes_price
  );

  const isMention = category.toLowerCase() === "mentions";
  const protocol = isMention ? mentionProtocol : sportsProtocol(market_type, spread_points);

  return `You are a disciplined prediction market analyst. Your job is to find genuine mispricings, not to force bets. Quality over quantity — it is BETTER to SKIP than to place a losing bet.

=== YOUR TRACK RECORD (READ THIS FIRST) ===
${histBlock}

IMPORTANT: Your track record shows clear patterns. Study it before making any recommendation.
If your BUY_YES win rate is below 20%, you should be extremely skeptical of YES recommendations.
If your BUY_NO win rate is above 70%, lean toward NO bets when you see an edge.
Your confidence scores have been INVERSELY correlated with success — higher confidence = worse outcomes. Calibrate accordingly.

=== MARKET DATA ===
- Ticker: ${ticker}
- Title: ${title}
- Category: ${category}
- Market type: ${market_type}
- Current YES price: ${yes_price} (implied probability: ${impliedProbability}%)
- 24h volume: ${volume_24h}
- Close time: ${close_time}
- Orderbook depth: ${orderbook_summary}

${marketExplanation}

${protocol}

STRATEGY RULES:
${JSON.stringify(strategy_rules, null, 2)}

=== DECISION FRAMEWORK ===

STEP 1 — UNDERSTAND THE CONTRACT:
  Read the title carefully. What does YES mean? What does NO mean?
  ${market_type === "game_winner" && contract_team
    ? `This contract (${contract_team}) resolves YES if ${contract_team} wins the game. YES = ${contract_team} wins. NO = ${contract_team} loses.`
    : market_type === "spread" && spread_points
      ? `YES = the team covers this spread (wins by more than ${spread_points} points). NO = they do NOT cover.`
      : "Make sure you understand exactly what outcome triggers YES vs NO."
  }

STEP 2 — RESEARCH (use web search):
  Search for current injury reports, line movements, and expert analysis.
  For spreads: find the Vegas/sportsbook consensus line and compare to this spread number.
  For game winners: find moneyline odds from major sportsbooks.

STEP 3 — CALCULATE YOUR EDGE:
  EDGE = (Your estimated true probability) - (Contract price as decimal)
  MINIMUM EDGE TO BET: 15% (not 5%, not 10% — fifteen percent minimum).
  If you cannot find a 15%+ edge with data to back it up, SKIP.

STEP 4 — BIAS CHECK:
  - Are you defaulting to YES because the title sounds like "will this happen?" Think again.
  - For spreads: large margins (10+ points) are VERY hard to cover. Default skepticism.
  - For game winners: the market already prices in team quality. Your edge must come from NEW information.
  - Check: would you bet your own money on this? If not, SKIP.

STEP 5 — SIZE CONSERVATIVELY:
  - 15-20% edge: 1-3 contracts (small exploratory bet)
  - 20-30% edge: 3-8 contracts (moderate conviction)
  - 30%+ edge: 8-15 contracts (strong conviction, rare)
  - NEVER exceed 15 contracts on a single market.
  - NEVER exceed 3% of bankroll on a single bet.

=== CONFIDENCE CALIBRATION ===
Your confidence score should reflect the ACTUAL probability your bet wins, not how sure you feel.
- 50-59: Slight lean, barely worth betting → 1-2 contracts max
- 60-69: Moderate edge with some supporting data → 2-5 contracts
- 70-79: Strong edge, multiple independent sources agree → 5-10 contracts
- 80+: Reserved for extreme mispricings with overwhelming evidence → 10-15 contracts
DO NOT assign 80+ confidence unless you have 3+ independent data points all pointing the same way.

=== CRITICAL RULES ===
1. SKIP is the DEFAULT. Only bet when you have a clear, quantifiable edge of 15%+.
2. NEVER buy contracts priced under $0.10 — these are lottery tickets, not edges.
3. NEVER buy contracts priced over $0.90 — insufficient upside.
4. For spread markets: if the spread is 10+ points, you need a 20%+ edge to bet YES. Large spreads rarely hit.
5. For game winners: if the price is above $0.85, the upside is tiny. Consider NO on the other team's contract or SKIP.
6. Your reasoning MUST cite specific data (injury reports, line movements, statistical models). "Team X is better" is not sufficient reasoning.
7. If web search returns no useful results, that alone is a reason to SKIP — you're betting blind.

After completing your research, respond with ONLY valid JSON (no markdown, no code blocks):
{
  "recommendation": "BUY_YES" | "BUY_NO" | "SKIP",
  "confidence": 0-100,
  "suggested_size": <number of contracts, max 15>,
  "reasoning": "2-3 sentences citing specific data: injury reports, line comparisons, model predictions. Include your estimated true probability vs market price.",
  "key_risk": "the single biggest thing that could make this bet lose",
  "data_sources": ["list of every source you searched and used"]
}`;
}

// ---------------------------------------------------------------------------
// Protocol blocks
// ---------------------------------------------------------------------------

function sportsProtocol(marketType: string, spreadPoints: number | null): string {
  const spreadGuidance = marketType === "spread" ? `
=== SPREAD MARKET ANALYSIS ===
This is a SPREAD market${spreadPoints ? ` (${spreadPoints} points)` : ""}. Spread bets are inherently harder than game winners.

KEY FACTS ABOUT SPREADS:
- NBA: Teams cover large spreads (10+) only ~30-35% of the time. The market knows this.
- NBA: Even dominant teams regularly win by comfortable margins but NOT by enough to cover large spreads.
- If Vegas has the line at -9.5 and this contract asks "wins by 16.5+", that's a HUGE gap. Be very skeptical of YES.
- Garbage time, bench players, and intentional fouling compress margins in blowouts.
- Historical data: buying NO on large spread contracts has been significantly more profitable than YES.

SPREAD DECISION RULES:
- Spread <= 5.5 points: Treat like a close game. Research matchups carefully.
- Spread 6-10 points: Lean NO unless you find strong evidence of a mismatch the market hasn't priced.
- Spread 10+ points: Strong default to NO or SKIP. Only bet YES if you have overwhelming evidence (key players OUT for losing team, Vegas line is much higher than this spread, etc).
` : "";

  const gameWinnerGuidance = marketType === "game_winner" ? `
=== GAME WINNER ANALYSIS ===
This is a GAME WINNER market. These are more predictable than spreads.

KEY CONSIDERATIONS:
- Make sure you understand WHICH TEAM this contract is for. The ticker suffix tells you.
- Compare this price to major sportsbook moneyline odds. Convert to implied probability.
- If sportsbook odds roughly match Kalshi, there's likely no edge — SKIP.
- Edges come from: late injury news not yet priced in, rest advantages, motivation factors.
- Heavily favored teams (>85%) offer thin margins. A 90c contract that wins nets you only 10c per contract.
` : "";

  return `${spreadGuidance}${gameWinnerGuidance}
=== SPORTS RESEARCH PROTOCOL ===

STEP 1 — FIND THE VEGAS LINE:
  Search for the current sportsbook consensus (DraftKings, FanDuel, BetMGM).
  Convert to implied probability. Compare to Kalshi price.
  If the gap is < 15%, there's probably no edge.

STEP 2 — CHECK INJURIES & LINEUPS:
  Search for today's injury reports. Look for:
  - Star players OUT or questionable
  - Back-to-back fatigue (especially for road teams)
  - Load management / rest games
  These are the PRIMARY source of edges the market may not have fully priced.

STEP 3 — SITUATIONAL FACTORS:
  - Motivation: playoff implications, rivalry games, tanking incentives
  - Home/away: home court matters, especially in NBA/CBB
  - Travel: cross-country flights, time zone changes
  - Recent form: hot/cold streaks (but don't overweight these)

STEP 4 — CROSS-REFERENCE:
  If 2+ independent sources (sportsbook odds, statistical models, injury reports) all point the same direction AND disagree with Kalshi's price by 15%+, you have a trade.
  If they don't agree, SKIP.

POSITION SIZING:
  - Max 3% of bankroll per bet
  - Max 10% across correlated bets (same game, same event)
  - Prefer smaller positions on more markets over large positions on fewer`;
}

const mentionProtocol = `
=== MENTION BETS RESEARCH PROTOCOL ===
Politicians and public figures are creatures of habit. Their words are more predictable than you think.

PROBABILITY FORMULA:
  P(mention) = Base_Rate + News_Cycle_Boost + Schedule_Signal + Persistence_Factor
  Cap at 95%, floor at 5%.

STEP 1 — EVENT CONTEXT:
  What is the event? Scripted (SOTU, prepared remarks) = more predictable.
  Freeform (press conf, rallies, Q&A) = less predictable but speaker habits help.

STEP 2 — NEWS CYCLE (search last 24-72 hours):
  Top headlines on major outlets. What Congress is debating. Breaking news.
  If a topic is dominating the news, it WILL come up.

STEP 3 — SPEAKER PATTERNS:
  Signature phrases (near-100% locks for long speeches).
  Current talking points. Social media posts (Truth Social for Trump = strong signal).

STEP 4 — CROSS-REFERENCE:
  | Signal                           | Weight |
  | In the news cycle right now?     | 25%    |
  | Speaker's signature phrase?      | 20%    |
  | On their recent social media?    | 20%    |
  | Related to event's purpose?      | 15%    |
  | Said it in last 3 similar events?| 15%    |
  | Controversial/avoidance word?    | 5%     |
  Score 80%+ = strong YES. 40-80% = deeper analysis. Below 40% = lean NO.

POSITION SIZING:
  - Max 3% bankroll per single mention bet
  - Max 8% across all mention bets for same event`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHistoricalBlock(perf: MarketAnalysisPromptParams["historical_performance"]): string {
  const parts: string[] = [];

  if (perf.category_win_rate !== null) {
    parts.push(`Overall win rate: ${(perf.category_win_rate * 100).toFixed(1)}%`);
  } else {
    parts.push("Overall win rate: no data yet");
  }

  parts.push(`Calibration: ${perf.confidence_calibration}`);
  parts.push(`\nBy recommendation type:\n${perf.recommendation_breakdown}`);
  parts.push(`\nBy side and price range:\n${perf.side_performance}`);

  return parts.join("\n");
}

function buildMarketExplanation(
  marketType: string,
  title: string,
  contractTeam: string | null,
  spreadPoints: number | null,
  yesPrice: number,
): string {
  if (marketType === "game_winner" && contractTeam) {
    return `=== CONTRACT EXPLANATION ===
This is a GAME WINNER contract for ${contractTeam}.
- YES (${(yesPrice * 100).toFixed(0)}c) = ${contractTeam} WINS the game
- NO (${((1 - yesPrice) * 100).toFixed(0)}c) = ${contractTeam} LOSES the game
Make sure your analysis is about whether ${contractTeam} will win, NOT the other team.`;
  }

  if (marketType === "spread" && spreadPoints !== null) {
    return `=== CONTRACT EXPLANATION ===
This is a SPREAD contract: "${title}"
- YES (${(yesPrice * 100).toFixed(0)}c) = the team wins by MORE than ${spreadPoints} points
- NO (${((1 - yesPrice) * 100).toFixed(0)}c) = the team does NOT win by more than ${spreadPoints} points (includes close wins and losses)
Large margins are hard to achieve. The NO side includes ALL outcomes except a blowout.`;
  }

  return "";
}

// ---------------------------------------------------------------------------
// Post-mortem prompt (unchanged)
// ---------------------------------------------------------------------------

/**
 * Builds the full prompt for AI post-mortem on a resolved bet.
 */
export function buildHitMissAnalysisPrompt(
  params: HitMissAnalysisPromptParams,
): string {
  const { title, side, entry_price, result, reasoning, confidence, resolution_context } = params;

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
