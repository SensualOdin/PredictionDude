import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { strategies } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/strategies — Fetch strategy version history
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(strategies)
      .orderBy(desc(strategies.createdAt));

    return NextResponse.json({ strategies: rows });
  } catch (error) {
    console.error("[Strategies API] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch strategies" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/strategies — Create a new strategy version
// ---------------------------------------------------------------------------

interface CreateStrategyBody {
  name?: string;
  rules: Record<string, unknown>;
  changeReason: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateStrategyBody;
    const { name, rules, changeReason } = body;

    if (!rules || !changeReason) {
      return NextResponse.json(
        { error: "rules and changeReason are required" },
        { status: 400 },
      );
    }

    // Find the current active strategy
    const [currentActive] = await db
      .select()
      .from(strategies)
      .where(eq(strategies.status, "active"))
      .limit(1);

    // Archive the current active strategy
    if (currentActive) {
      await db
        .update(strategies)
        .set({ status: "archived" })
        .where(eq(strategies.id, currentActive.id));
    }

    // Create the new strategy version
    const [newStrategy] = await db
      .insert(strategies)
      .values({
        name: name ?? `Strategy v${(currentActive?.version ?? 0) + 1}`,
        rules,
        parentId: currentActive?.id ?? null,
        changeReason,
        status: "active",
      })
      .returning();

    return NextResponse.json({ strategy: newStrategy }, { status: 201 });
  } catch (error) {
    console.error("[Strategies API] POST failed:", error);
    return NextResponse.json({ error: "Failed to create strategy" }, { status: 500 });
  }
}
