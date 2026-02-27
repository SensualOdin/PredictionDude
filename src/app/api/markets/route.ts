import { NextRequest, NextResponse } from "next/server";
import { kalshi } from "@/lib/kalshi";
import { categorizeMarket } from "@/lib/categorize";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const params: Record<string, string | number | undefined> = {
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      series_ticker: searchParams.get("category") ?? undefined,
    };

    const data = await kalshi.getMarkets(params);

    // Inject inferred category since Kalshi API doesn't provide one
    const markets = (data.markets ?? []).map((m: Record<string, unknown>) => ({
      ...m,
      category: categorizeMarket(
        String(m.title ?? ""),
        m.event_ticker as string | null,
      ),
    }));

    return NextResponse.json({ ...data, markets });
  } catch (error) {
    console.error("[API] GET /api/markets failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch markets" },
      { status: 500 },
    );
  }
}
