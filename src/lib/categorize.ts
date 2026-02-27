/**
 * Categorize a Kalshi market by keyword matching on title and event_ticker.
 * Kalshi's API does not return a category field, so we infer it.
 */

const CATEGORY_PATTERNS: [string, RegExp][] = [
  ["Mentions", /\b(mention|say\b|said\b|says\b|word\b|phrase|utter|speak about|talk about|refer to|bring up|state of the union|sotu|address\b|speech|press conference|presser|debate|remarks|tweet|post about|comment on|announce)\b|\bwill .{1,40} (say|mention|use the word|bring up|refer to)\b/i],
  ["Sports", /\b(nba|nfl|mlb|nhl|fifa|ncaa|super bowl|world series|stanley cup|championship|playoffs|game [0-9]|touchdown|home run|mvp|draft pick|premier league|uefa|ufc|boxing|tennis|golf|pga|winner\??|wins by|points\??|spread|over under|moneyline)\b|vs\s/i],
  ["Weather", /\b(weather|temperature|rain|snow|hurricane|tornado|storm|flood|drought|frost|heatwave|wildfire|noaa|celsius|fahrenheit|warm|cold snap)\b/i],
  ["Economics", /\b(cpi|gdp|inflation|unemployment|fed\b|interest rate|jobs report|payroll|housing|retail sales|consumer|recession|treasury|bond|stock market|s&p|nasdaq|dow jones|fomc|tariff|trade deficit|economic)\b/i],
  ["Politics", /\b(president|election|vote|congress|senate|house of rep|republican|democrat|governor|mayor|cabinet|impeach|poll|approval rating|biden|trump|political|legislation|executive order|supreme court)\b/i],
];

export function categorizeMarket(title: string, eventTicker?: string | null): string {
  const text = `${title} ${eventTicker ?? ""}`;
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category.toLowerCase();
  }
  return "other";
}
