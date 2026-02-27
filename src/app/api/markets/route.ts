import { NextRequest, NextResponse } from "next/server";
import { kalshi } from "@/lib/kalshi";

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

    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] GET /api/markets failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch markets" },
      { status: 500 },
    );
  }
}
