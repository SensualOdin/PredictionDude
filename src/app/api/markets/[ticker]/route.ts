import { NextRequest, NextResponse } from "next/server";
import { kalshi } from "@/lib/kalshi";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const { ticker } = await params;

    const [marketResponse, orderbookResponse] = await Promise.all([
      kalshi.getMarket(ticker),
      kalshi.getOrderbook(ticker),
    ]);

    return NextResponse.json({
      market: marketResponse,
      orderbook: orderbookResponse,
    });
  } catch (error) {
    console.error("[API] GET /api/markets/[ticker] failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch market details" },
      { status: 500 },
    );
  }
}
