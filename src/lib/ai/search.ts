// ---------------------------------------------------------------------------
// Brave Search — fetches real-time web context for market analysis.
// Returns a concise summary string to inject into the AI prompt.
// ---------------------------------------------------------------------------

interface BraveSearchResult {
  title: string;
  description: string;
  url: string;
}

interface BraveSearchResponse {
  web?: {
    results?: BraveSearchResult[];
  };
}

/**
 * Searches Brave for real-time context on a market.
 * Returns a formatted string of top results, or empty string on failure.
 */
export async function searchMarketContext(
  marketTitle: string,
  category: string,
): Promise<string> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return "";

  try {
    const query = buildSearchQuery(marketTitle, category);

    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&freshness=pd`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
      },
    );

    if (!res.ok) {
      console.error(`[BraveSearch] ${res.status}: ${res.statusText}`);
      return "";
    }

    const data = (await res.json()) as BraveSearchResponse;
    const results = data.web?.results ?? [];

    if (results.length === 0) return "";

    const formatted = results
      .slice(0, 5)
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.description}`)
      .join("\n\n");

    return `\n=== LIVE WEB CONTEXT (from Brave Search) ===\n${formatted}\n`;
  } catch (error) {
    console.error("[BraveSearch] Failed:", error);
    return "";
  }
}

function buildSearchQuery(title: string, category: string): string {
  const cleaned = title
    .replace(/\?$/, "")
    .replace(/Winner$/, "")
    .trim();

  if (category.toLowerCase() === "mentions") {
    return `${cleaned} today news`;
  }

  // Detect spread markets: "Team wins by over X Points"
  const spreadMatch = title.match(/(.+?)\s+wins?\s+by\s+over\s+([\d.]+)\s+Points?/i);
  if (spreadMatch) {
    const teamName = spreadMatch[1].trim();
    return `${teamName} game today spread picks injury report`;
  }

  // Detect game winner markets: "Team A at Team B Winner"
  const gameMatch = title.match(/(.+?)\s+at\s+(.+?)\s+Winner/i);
  if (gameMatch) {
    const away = gameMatch[1].trim();
    const home = gameMatch[2].trim();
    return `${away} vs ${home} today odds picks injury report`;
  }

  // Fallback: generic sports query
  return `${cleaned} today odds injury report picks`;
}
