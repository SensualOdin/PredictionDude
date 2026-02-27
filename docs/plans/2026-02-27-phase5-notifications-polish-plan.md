# Phase 5: Notifications + Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make settings persistent via Supabase, overhaul the app for mobile-first usage (bottom tab bar, responsive layouts), add one-click bet execution on dashboard picks, and wire up lightweight push notifications.

**Architecture:** New `settings` table (single-row) in Supabase drives trading mode, confidence threshold, and scan interval across the app. Sidebar becomes a responsive component that renders as a bottom tab bar on mobile. Push uses the Web Push API with a minimal service worker.

**Tech Stack:** Next.js 16, Drizzle ORM, Supabase (PostgreSQL), React Query, Tailwind CSS, shadcn/ui, web-push, Sonner (toasts)

---

## Part 1: Functional Settings

### Task 1: Add `settings` table to schema + migrate

**Files:**
- Modify: `src/lib/db/schema.ts:173` (before type exports)

**Step 1: Add the settings table definition to schema.ts**

After the `alertsRelations` block (line 173) and before the type exports comment (line 175), add:

```typescript
// ─── Settings ──────────────────────────────────────────────────────────────────

export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tradingMode: text("trading_mode").notNull().default("paper"),
  kalshiEnv: text("kalshi_env").notNull().default("demo"),
  minConfidenceThreshold: integer("min_confidence_threshold").notNull().default(75),
  scanIntervalHours: integer("scan_interval_hours").notNull().default(4),
  pushEnabled: boolean("push_enabled").notNull().default(false),
  pushSubscription: jsonb("push_subscription"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

Also add type exports at the bottom:

```typescript
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
```

**Step 2: Apply the migration via Supabase MCP**

Run migration `add_settings_table`:

```sql
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trading_mode TEXT NOT NULL DEFAULT 'paper',
  kalshi_env TEXT NOT NULL DEFAULT 'demo',
  min_confidence_threshold INTEGER NOT NULL DEFAULT 75,
  scan_interval_hours INTEGER NOT NULL DEFAULT 4,
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  push_subscription JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed single row with defaults
INSERT INTO settings (trading_mode, kalshi_env, min_confidence_threshold, scan_interval_hours, push_enabled)
VALUES ('paper', 'demo', 75, 4, false);
```

**Step 3: Verify build compiles**

Run: `PATH="/opt/homebrew/opt/node@20/bin:/bin:/usr/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" npx next build`
Expected: Compiles successfully

**Step 4: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat: add settings table to schema and migrate"
```

---

### Task 2: Create GET/PUT `/api/settings` route

**Files:**
- Create: `src/app/api/settings/route.ts`

**Step 1: Create the settings API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// GET /api/settings — Returns the single settings row (creates if missing)
export async function GET() {
  try {
    const rows = await db.select().from(settings).limit(1);

    if (rows.length === 0) {
      // Auto-create default settings row
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

    // Build update object from allowed fields only
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Get the existing settings row
    const rows = await db.select().from(settings).limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No settings found" }, { status: 404 });
    }

    const { eq } = await import("drizzle-orm");
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
```

**Step 2: Verify build compiles**

Run: `PATH="/opt/homebrew/opt/node@20/bin:/bin:/usr/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" npx next build`
Expected: Compiles successfully, new route `/api/settings` appears

**Step 3: Commit**

```bash
git add src/app/api/settings/route.ts
git commit -m "feat: add GET/PUT /api/settings API route"
```

---

### Task 3: Wire settings page to the API

**Files:**
- Modify: `src/app/settings/page.tsx`

**Step 1: Replace the entire settings page with API-wired version**

Key changes:
- Replace `useState` with `useQuery` to load settings from `/api/settings`
- Add `useMutation` to PUT changes on toggle/change
- Add debounced auto-save for slider/dropdown changes
- Remove the Kalshi API Key and Claude AI Key sections (those stay in `.env.local`)
- Show a loading skeleton while settings load
- Show toast (Sonner) on save success/error

The page should:
- Load current `tradingMode`, `kalshiEnv`, `minConfidenceThreshold`, `scanIntervalHours` from the API
- On any change, immediately update local state AND fire a debounced PUT
- Trading Mode toggle: switches `tradingMode` between `'paper'` and `'real'`
- Environment select: switches `kalshiEnv` between `'demo'` and `'production'`
- Confidence slider: updates `minConfidenceThreshold` (debounced 500ms)
- Scan schedule dropdown: updates `scanIntervalHours`
- Remove API key input sections (they don't persist to DB)

**Step 2: Verify build compiles and page loads**

Run build, then dev server. Navigate to `/settings`, change a toggle, refresh — value should persist.

**Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: wire settings page to Supabase API with auto-save"
```

---

### Task 4: Make sidebar mode indicator dynamic

**Files:**
- Modify: `src/components/sidebar.tsx:99-109`

**Step 1: Add settings query to sidebar**

Add `useQuery` for `/api/settings` at the top of the `Sidebar` component (after `usePathname`). Use `refetchInterval: 60_000` so the mode badge stays current.

**Step 2: Replace hardcoded "Paper" badge**

Replace the static `<Badge>Paper</Badge>` block (lines 100-108) with a dynamic version:
- If `tradingMode === 'real'`: red badge, "Real" label, "Real Trading" expanded text
- If `tradingMode === 'paper'`: amber badge, "Paper" label, "Paper Trading" expanded text
- If loading: show "..." in the badge

**Step 3: Verify build + visual check**

Toggle trading mode in settings, sidebar badge should update.

**Step 4: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "feat: make sidebar mode badge dynamic from settings"
```

---

### Task 5: Make PlaceBetDialog default mode from settings

**Files:**
- Modify: `src/components/place-bet-dialog.tsx:42`

**Step 1: Add settings query to the dialog**

Add `useQuery` for `/api/settings` inside `PlaceBetDialog`. Initialize the `mode` state from `settingsData?.tradingMode ?? "paper"` instead of hardcoded `"paper"`.

Use a `useEffect` to update mode state when settings data loads:

```typescript
const { data: settingsData } = useQuery({
  queryKey: ["settings"],
  queryFn: () => fetch("/api/settings").then((r) => r.json()),
});

const [mode, setMode] = useState<"paper" | "real">("paper");

useEffect(() => {
  if (settingsData?.tradingMode) {
    setMode(settingsData.tradingMode as "paper" | "real");
  }
}, [settingsData?.tradingMode]);
```

**Step 2: Verify build + test**

Open Place Bet dialog — mode should match settings. Change in settings, reopen dialog — should reflect new mode.

**Step 3: Commit**

```bash
git add src/components/place-bet-dialog.tsx
git commit -m "feat: default PlaceBetDialog mode from settings"
```

---

## Part 2: Mobile-Responsive Overhaul

### Task 6: Create bottom tab bar component for mobile

**Files:**
- Create: `src/components/bottom-nav.tsx`

**Step 1: Create the bottom navigation component**

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Target,
  BarChart3,
  Brain,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", icon: LayoutDashboard, href: "/" },
  { label: "Markets", icon: TrendingUp, href: "/markets" },
  { label: "Bets", icon: Target, href: "/bets" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Strategy", icon: Brain, href: "/strategy" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-zinc-800/60 bg-zinc-950 md:hidden">
      {navItems.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-w-[3rem]",
              isActive ? "text-emerald-400" : "text-zinc-500"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] leading-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

**Step 2: Verify build**

Run build. Component should compile.

**Step 3: Commit**

```bash
git add src/components/bottom-nav.tsx
git commit -m "feat: create mobile bottom tab bar component"
```

---

### Task 7: Update layout for responsive sidebar/bottom nav

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/sidebar.tsx:37-40`

**Step 1: Hide sidebar on mobile, show bottom nav**

In `src/components/sidebar.tsx`, add `hidden md:flex` to the aside element's className (line 39) so it hides on mobile:

```
"group/sidebar fixed left-0 top-0 z-40 hidden h-screen w-16 flex-col border-r border-zinc-800/60 bg-zinc-950 transition-all duration-300 ease-in-out hover:w-60 md:flex"
```

**Step 2: Update layout.tsx**

Import `BottomNav` and render it. Adjust main padding:

```typescript
import { BottomNav } from "@/components/bottom-nav";
```

Change the main element's className from `pl-16` to `pl-0 md:pl-16` and add bottom padding on mobile for the bottom nav:

```html
<main className="flex-1 pl-0 pb-14 md:pl-16 md:pb-0">
  <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
    {children}
  </div>
</main>
```

Add `<BottomNav />` after `</main>` (inside the flex container).

**Step 3: Verify on different screen sizes**

Run dev server. At < 768px: bottom nav visible, sidebar hidden. At >= 768px: sidebar visible, bottom nav hidden.

**Step 4: Commit**

```bash
git add src/app/layout.tsx src/components/sidebar.tsx src/components/bottom-nav.tsx
git commit -m "feat: responsive layout with bottom nav on mobile, sidebar on desktop"
```

---

### Task 8: Mobile-responsive dashboard

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update dashboard responsive classes**

Key changes to `src/app/page.tsx`:
- Stat cards grid (line 119): Change `grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4` to `grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4` — show 2-up on mobile for compactness
- Stat card values (line 133): Add `text-xl sm:text-2xl` for slightly smaller on mobile
- Recommendation cards (line 170): Wrap the content at narrow widths — change `flex items-center gap-4 py-4` to `flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap sm:gap-4 sm:py-4`
- Place Bet button area: Add `w-full sm:w-auto` so buttons go full-width on mobile
- Header text (line 112): Add `text-xl sm:text-2xl` for mobile sizing

**Step 2: Verify on mobile viewport**

Check 375px wide viewport — cards should stack neatly, no horizontal scroll.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: mobile-responsive dashboard layout"
```

---

### Task 9: Mobile-responsive markets page

**Files:**
- Modify: `src/app/markets/page.tsx`

**Step 1: Update markets page responsive classes**

Key changes:
- Search bar: Already full-width, good
- Category filter: If using tab buttons, make them horizontally scrollable: `flex gap-2 overflow-x-auto pb-2 -mx-3 px-3` with `scrollbar-hide` or `-webkit-overflow-scrolling: touch`
- Card grid: Already has `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — keep as-is
- Card content: Ensure text doesn't overflow — add `truncate` to title, use `text-xs` for price labels on mobile
- Touch targets: All clickable cards should have min-h-[44px] interactive area

**Step 2: Verify on mobile viewport**

**Step 3: Commit**

```bash
git add src/app/markets/page.tsx
git commit -m "feat: mobile-responsive markets page"
```

---

### Task 10: Mobile-responsive bets page (table to cards)

**Files:**
- Modify: `src/app/bets/page.tsx`

**Step 1: Replace table with responsive card layout on mobile**

The bets page currently uses a table. On mobile, tables are hard to use. Replace with:
- `< sm`: Card layout — each bet is a stacked card showing market title, side badge, entry/contracts, P&L, status
- `>= sm`: Keep the existing table layout

Use a `hidden sm:block` wrapper for the table and a `block sm:hidden` wrapper for the card list.

Mobile bet card structure:
```
┌──────────────────────────────┐
│ [YES badge]  Market Title    │
│ 10 contracts @ $0.56 · paper │
│ Cost: $5.60    P&L: +$4.40  │
│                    [open] ●  │
└──────────────────────────────┘
```

Tab buttons: Make them larger touch targets on mobile — `min-h-[44px] px-4`.

**Step 2: Verify mobile and desktop views**

**Step 3: Commit**

```bash
git add src/app/bets/page.tsx
git commit -m "feat: mobile-responsive bets page with card layout"
```

---

### Task 11: Mobile-responsive analytics and strategy pages

**Files:**
- Modify: `src/app/analytics/page.tsx`
- Modify: `src/app/strategy/page.tsx`

**Step 1: Analytics page**

- Charts grid (currently `grid-cols-1 lg:grid-cols-2`): Keep as-is, already stacks on mobile
- Add `min-h-[200px]` to chart containers for readability
- Reduce chart padding on mobile
- Header: `text-xl sm:text-2xl`

**Step 2: Strategy page**

- Already uses `grid-cols-1 lg:grid-cols-2` for version history + proposals
- Add tighter padding on mobile (p-2 vs p-3 on cards)
- Header: `text-xl sm:text-2xl`

**Step 3: Verify on mobile viewport**

**Step 4: Commit**

```bash
git add src/app/analytics/page.tsx src/app/strategy/page.tsx
git commit -m "feat: mobile-responsive analytics and strategy pages"
```

---

## Part 3: One-Click Execute

### Task 12: Add "Execute AI Pick" button to dashboard

**Files:**
- Modify: `src/app/page.tsx:164-197` (recommendations section)

**Step 1: Add execute mutation and settings query**

At the top of `DashboardPage`, add:
- `useQuery` for `/api/settings` to get current trading mode
- `useMutation` for executing a bet via `POST /api/bets`
- Import `toast` from `sonner` and `Loader2` from `lucide-react`

**Step 2: Add Execute button to recommendation cards**

Inside each recommendation card (after the PlaceBetDialog on line 191), add an Execute button:

```tsx
<Button
  size="sm"
  onClick={() => executeBet.mutate({
    marketTicker: rec.marketTicker ?? rec.market_ticker,
    side: rec.recommendation === "BUY_NO" ? "no" : "yes",
    contracts: rec.suggestedSize ?? 10,
    entryPrice: 0.5, // current yes price
    mode: settingsData?.tradingMode ?? "paper",
    recommendationId: rec.id,
  })}
  disabled={executeBet.isPending}
  className={cn(
    "font-semibold",
    settingsData?.tradingMode === "real"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-emerald-600 hover:bg-emerald-700 text-white"
  )}
>
  {executeBet.isPending ? (
    <Loader2 className="h-3 w-3 animate-spin" />
  ) : settingsData?.tradingMode === "real" ? (
    "Execute (Real $)"
  ) : (
    "Execute"
  )}
</Button>
```

On success, show toast: `toast.success(\`Placed \${side.toUpperCase()} x \${contracts} on \${marketTicker} (\${mode})\`)`

On error, show: `toast.error(error.message)`

**Step 3: Mobile layout**

On mobile, stack the Execute and Place Bet buttons vertically:
- Wrap both buttons in a `flex flex-col sm:flex-row gap-2 shrink-0` container

**Step 4: Verify build + test both buttons**

**Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add one-click Execute AI Pick button to dashboard"
```

---

## Part 4: Push Notifications

### Task 13: Install web-push and generate VAPID keys

**Step 1: Install web-push**

Run: `PATH="/opt/homebrew/opt/node@20/bin:/bin:/usr/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" npm install web-push`

**Step 2: Generate VAPID keys**

Run: `PATH="/opt/homebrew/opt/node@20/bin:/bin:/usr/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" npx web-push generate-vapid-keys --json`

Copy the output and add to `.env.local`:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey>
VAPID_PRIVATE_KEY=<privateKey>
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install web-push for push notifications"
```

---

### Task 14: Create PWA manifest and service worker

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`
- Modify: `src/app/layout.tsx` (add manifest link + SW registration script)

**Step 1: Create manifest.json**

```json
{
  "name": "PredictionDude",
  "short_name": "PredDude",
  "description": "AI-powered prediction market assistant",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#09090b",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

Note: We'll use placeholder icons for now. George can replace them later.

**Step 2: Create sw.js (minimal push handler)**

```javascript
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "PredictionDude";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
```

**Step 3: Add manifest link to layout.tsx metadata**

In `src/app/layout.tsx`, update the metadata export:

```typescript
export const metadata: Metadata = {
  title: "Kalshi AI Trader",
  description: "AI-powered prediction market assistant",
  manifest: "/manifest.json",
};
```

**Step 4: Add SW registration**

Create a client component `src/components/sw-register.tsx`:

```typescript
"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("[SW] Registration failed:", err);
      });
    }
  }, []);
  return null;
}
```

Import and render it in `layout.tsx` inside `<Providers>`, before the flex container.

**Step 5: Commit**

```bash
git add public/manifest.json public/sw.js src/components/sw-register.tsx src/app/layout.tsx
git commit -m "feat: add PWA manifest, service worker, and SW registration"
```

---

### Task 15: Create push notification utility

**Files:**
- Create: `src/lib/push.ts`

**Step 1: Create push sending utility**

```typescript
import webpush from "web-push";
import { db } from "@/lib/db";
import { settings, alerts } from "@/lib/db/schema";

// Configure VAPID
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:george@predictiondude.com",
    vapidPublicKey,
    vapidPrivateKey
  );
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushNotification(
  payload: PushPayload,
  alertData?: { recommendationId: string; type: string }
): Promise<boolean> {
  try {
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log("[Push] VAPID keys not configured, skipping push");
      return false;
    }

    // Get the push subscription from settings
    const rows = await db.select().from(settings).limit(1);
    const userSettings = rows[0];

    if (!userSettings?.pushEnabled || !userSettings?.pushSubscription) {
      return false;
    }

    const subscription = userSettings.pushSubscription as webpush.PushSubscription;

    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );

    // Log to alerts table
    if (alertData) {
      await db.insert(alerts).values({
        recommendationId: alertData.recommendationId,
        type: alertData.type,
        title: payload.title,
        body: payload.body,
      });
    }

    return true;
  } catch (error) {
    console.error("[Push] Failed to send notification:", error);
    return false;
  }
}
```

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add src/lib/push.ts
git commit -m "feat: add push notification utility with web-push"
```

---

### Task 16: Add push subscription toggle to settings page

**Files:**
- Modify: `src/app/settings/page.tsx`

**Step 1: Add push notification toggle section**

Add a new card to the settings page for "Push Notifications" with:
- An "Enable Push Notifications" switch
- When toggled ON:
  1. Call `Notification.requestPermission()`
  2. If granted, get the service worker registration
  3. Call `registration.pushManager.subscribe()` with the VAPID public key
  4. PUT the subscription JSON to `/api/settings` as `pushSubscription`
  5. Also PUT `pushEnabled: true`
- When toggled OFF:
  1. Call `registration.pushManager.getSubscription()` then `subscription.unsubscribe()`
  2. PUT `pushEnabled: false, pushSubscription: null` to `/api/settings`
- Show current permission status: granted / denied / default
- If denied, show helper text: "Notifications are blocked. Enable them in your browser settings."

**Step 2: Verify — toggle on, check browser permission prompt**

**Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add push notification subscription toggle to settings"
```

---

### Task 17: Wire push triggers into cron routes

**Files:**
- Modify: `src/app/api/cron/scan/route.ts:163-175`
- Modify: `src/app/api/cron/resolve/route.ts:126-137`

**Step 1: Add push to cron scan**

After storing the recommendation (line 173 of scan route), add:

```typescript
// Send push if confidence meets threshold
if (analysis.confidence >= minConfidenceThreshold && analysis.recommendation !== "SKIP") {
  await sendPushNotification(
    {
      title: `New Pick: ${analysis.confidence}% confidence`,
      body: `${String(market.title)} — ${analysis.recommendation === "BUY_YES" ? "YES" : "NO"}`,
      url: `/markets/${ticker}`,
    },
    { recommendationId: recId, type: "new_opportunity" }
  );
}
```

Also add at the top of the scan handler: read `minConfidenceThreshold` from settings.

```typescript
const [userSettings] = await db.select().from(settings).limit(1);
const minConfidenceThreshold = userSettings?.minConfidenceThreshold ?? 75;
```

Import `sendPushNotification` from `@/lib/push` and `settings` from schema.

**Step 2: Add push to cron resolve**

After updating the bet record in the resolve route (around line 83), add:

```typescript
// Send push notification for resolved bet
await sendPushNotification(
  {
    title: `Bet ${betWon ? "Won" : "Lost"}: ${market.title ?? bet.marketTicker}`,
    body: `${betWon ? "+" : ""}$${Number(pnl).toFixed(2)} P&L`,
    url: "/bets",
  },
  { recommendationId: bet.recommendationId ?? bet.id, type: "bet_resolved" }
);
```

Import `sendPushNotification` from `@/lib/push`.

**Step 3: Verify build**

**Step 4: Commit**

```bash
git add src/app/api/cron/scan/route.ts src/app/api/cron/resolve/route.ts
git commit -m "feat: trigger push notifications on high-confidence picks and bet resolution"
```

---

### Task 18: Final build verification and push to GitHub

**Step 1: Run full build**

Run: `PATH="/opt/homebrew/opt/node@20/bin:/bin:/usr/bin:/usr/local/bin:/opt/homebrew/bin:$PATH" npx next build`
Expected: Clean compilation, all routes present

**Step 2: Manual smoke test**

Run dev server and check:
- [ ] Settings page loads values from DB
- [ ] Toggling trading mode persists on refresh
- [ ] Sidebar badge reflects current trading mode
- [ ] Mobile viewport shows bottom nav, hides sidebar
- [ ] Dashboard recommendation cards show Execute button
- [ ] Bets page shows card layout on mobile
- [ ] All pages render without horizontal scrolling at 375px

**Step 3: Push to GitHub**

```bash
git push origin main
```
