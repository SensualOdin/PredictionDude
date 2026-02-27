import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// GET /api/settings — Returns the single settings row (creates if missing)
export async function GET() {
  try {
    const rows = await db.select().from(settings).limit(1);

    if (rows.length === 0) {
      const [created] = await db
        .insert(settings)
        .values({})
        .returning();
      return NextResponse.json(created);
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("[Settings API] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// PUT /api/settings — Partial update of the settings row
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const allowedFields = [
      "tradingMode",
      "kalshiEnv",
      "minConfidenceThreshold",
      "scanIntervalHours",
      "pushEnabled",
      "pushSubscription",
    ] as const;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const rows = await db.select().from(settings).limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No settings found" }, { status: 404 });
    }

    const [updated] = await db
      .update(settings)
      .set(updateData)
      .where(eq(settings.id, rows[0].id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Settings API] PUT failed:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
