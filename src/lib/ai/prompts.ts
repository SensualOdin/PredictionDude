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

  const isMention = category.toLowerCase() === "mentions";

  const sportsProtocol = `
=== SPORTS BETTING RESEARCH PROTOCOL ===
You are not gambling. You are identifying mispricings between market odds and reality.

STEP 1 — FIND THE EDGE:
  EDGE = (Your estimated true probability) - (Kalshi contract price as decimal)
  If EDGE > 10%, proceed. If EDGE < 10%, SKIP — margin too thin.
  Compare Kalshi odds to traditional sportsbooks (DraftKings, FanDuel, BetMGM) — price gaps = opportunity.

STEP 2 — DEEP DATA COLLECTION (search for ALL of these):
  Team/Player Performance:
  - Last 10 games: W/L record, scores, margins
  - Home vs. away splits
  - Head-to-head history between the two teams
  - Current streak, rest days since last game, back-to-back status
  Injury & Lineup Intel:
  - Official injury reports, confirmed starters, minutes restrictions
  - Recent trade/waiver activity
  Situational Factors:
  - Motivation (playoff implications, rivalry, tanking)
  - Travel schedule (West coast teams playing East coast, etc.)
  - Weather (outdoor sports)
  Market Context:
  - Line movement direction (sharp bettor signals)
  - Volume comparison to similar markets
  - Reverse line movement (sharp money signal)

STEP 3 — STATISTICAL MODEL CHECK:
  Cross-reference your estimate with at least 2: FiveThirtyEight/Silver Bulletin, ESPN BPI/FPI, TeamRankings, KenPom (CBB), Sagarin, traditional sportsbook consensus.
  If 2+ independent models agree with your assessment AND disagree with Kalshi's price, you have a confirmed edge.

STEP 4 — BIAS CHECK (Favorite-Longshot Trap):
  - NEVER buy contracts under $0.10 — math is against you.
  - Favor contracts priced $0.60-$0.90 where you've identified an edge — best risk/reward.
  - "NO" contracts on longshots are often better value than "YES" on favorites.
  - Contracts under $0.10: historically -60%+ losses. Above $0.80: small positive returns. Above $0.95: ~98% win rate.

STEP 5 — DECISION MATRIX (score 1-5 each):
  | Criterion              | Weight |
  | Edge size              | 25%    |
  | Data quality           | 20%    |
  | Model agreement        | 20%    |
  | Market liquidity       | 15%    |
  | Confidence alignment   | 10%    |
  | Risk/reward ratio      | 10%    |
  Weighted score > 3.5 = BET. Score 2.5-3.5 = SKIP. Below 2.5 = HARD SKIP.

SPORT-SPECIFIC EDGES:
  NBA: Back-to-back games (2nd night teams lose more), rest advantage (3+ days vs B2B = massive edge), 4Q load management affects O/U, tanking season Feb-April.
  NFL: Weather crushes passing (bet unders in rain/snow/wind >20mph), Thursday home teams have edge, divisional games closer than priced.
  MLB: Starting pitcher matchups dominate, bullpen usage day-before (4+ relievers = gassed), park factors.
  CBB: KenPom efficiency gap (15+ spots = bet favorite), conference tournament fatigue, transfer portal chaos early season.

POSITION SIZING:
  - Max 5% of bankroll per bet, max 15% across correlated bets
  - 10-15% edge: 2% bankroll, 15-25% edge: 3-4%, 25%+ edge: 5% (max)`;

  const mentionProtocol = `
=== MENTION BETS RESEARCH PROTOCOL ===
Politicians and public figures are creatures of habit. Their words are more predictable than you think — if you do the homework.

PROBABILITY FORMULA:
  P(mention) = Base_Rate + News_Cycle_Boost + Schedule_Signal + Persistence_Factor
  Where:
  - Base_Rate = Historical frequency of this topic at this event type
  - News_Cycle_Boost: 0-1 outlets +0%, 2-3 +15%, 4-5 +30%, all major outlets leading +45%
  - Schedule_Signal: topic in WH daily guidance +40%, related policy event +25%, related vote +20%
  - Persistence_Factor: active military conflict +35%, ongoing legislative fight +20%, story >3d declining -15%, story >7d no updates -30%
  Cap at 99%, floor at 2%.

STEP 1 — EVENT CONTEXT:
  - What is the event? When? Who is speaking?
  - Scripted (SOTU, prepared remarks) = more predictable. Freeform (press conf, rallies, Q&A) = less predictable but speaker habits help.

STEP 2 — NEWS CYCLE (search the last 24-72 hours):
  - Top headlines on AP, Reuters, CNN, Fox, NYT, WSJ
  - What Congress is debating, any breaking news in last 24h
  - What questions reporters are likely to ask
  - Speaker's social media posts in last 72h (if Trump posts about a topic on Truth Social, it has very high probability of appearing in the next speech)

STEP 3 — SPEAKER PATTERNS:
  - Signature phrases (near-100% locks for extended speeches)
  - Current talking points this week
  - Avoidance patterns (what they deliberately don't say)
  - Speech length correlation (longer = more words = higher probability of any given word)
  - "The Billboard Effect": Trump's branded repetition makes his patterns highly predictable.

STEP 4 — CROSS-REFERENCE SIGNALS (score each):
  | Signal                           | Weight |
  | In the news cycle right now?     | 25%    |
  | Speaker's signature phrase?      | 20%    |
  | On their recent social media?    | 20%    |
  | Related to event's purpose?      | 15%    |
  | Said it in last 3 similar events?| 15%    |
  | Controversial/avoidance word?    | 5%     |
  Score 80%+ = strong YES. 40-80% = deeper analysis. Below 40% = lean NO.

STEP 5 — COMPARE TO MARKET PRICE:
  YOUR EDGE = (Your probability) - (Kalshi price). Min edge to bet: 10%+. Sweet spot: 15-25%.
  Best value zone: $0.25-$0.75 where research can differentiate.
  Contrarian NO bets often have more value — casual bettors overbet YES.
  NEVER buy contracts under $0.10 or over $0.90.

COMMUNITY-PROVEN STRATEGIES:
  - "News Cycle Lock" (85%+ win rate): top story by 10 AM ET will come up at WH briefing with near-certainty.
  - "SOTU Broad Yes": buy YES on broad topic categories (economy, military, immigration) — nearly always mentioned in 60-90 min speeches.
  - "Deflection Arbitrage": even dodging counts — "I'm not commenting on China" still has "China" in the transcript.
  - "Fed Whisperer": FOMC statement drops 2:00 PM ET, presser at 2:30. Trade in that 30-min gap.
  - "Transcript Scraper": historical base rates — "China" at ~73% of WH briefings.

POSITION SIZING:
  - Max 5% bankroll per single mention bet
  - Max 10% across all mention bets for same event (correlated — short speech hurts all YES bets)`;

  return `You are an elite prediction market analyst. You MUST use your web search tool to research current real-time information before making any recommendation. Search for multiple angles — never rely on assumptions alone.

MARKET DATA:
- Title: ${title}
- Category: ${category}
- Current YES price: ${yes_price} (implied probability: ${impliedProbability}%)
- 24h volume: ${volume_24h}
- Close time: ${close_time}
- Orderbook depth: ${orderbook_summary}

${isMention ? mentionProtocol : sportsProtocol}

CURRENT STRATEGY RULES:
${JSON.stringify(strategy_rules, null, 2)}

HISTORICAL PERFORMANCE ON SIMILAR MARKETS:
${historicalBlock}

CRITICAL RULES:
1. NEVER recommend contracts priced under $0.10 or over $0.90 — no edge in the extremes.
2. Only recommend when YOUR calculated edge is > 10% over the Kalshi price.
3. Consider NO bets — they are often better value than YES bets on favorites.
4. Factor in the favorite-longshot bias: cheap contracts lose more than their price implies.
5. If data is insufficient or conflicting, SKIP. Passing is a valid and often correct decision.

After completing your FULL research protocol, respond with ONLY valid JSON (no markdown, no code blocks):
{
  "recommendation": "BUY_YES" | "BUY_NO" | "SKIP",
  "confidence": 0-100,
  "suggested_size": <number of contracts>,
  "reasoning": "2-3 sentences explaining the edge you found and how it compares to the market price",
  "key_risk": "the single biggest thing that could make this bet lose",
  "data_sources": ["list of every source you searched and used"]
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
