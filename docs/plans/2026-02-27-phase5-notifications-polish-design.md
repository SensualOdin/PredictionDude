# Phase 5: Notifications + Polish — Design

**Date**: 2026-02-27
**Status**: Approved
**Approach**: A — Settings > Mobile > One-Click Execute > Push (highest-impact first)

---

## 1. Functional Settings

### New `settings` table (Supabase, single-row)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PK | Single row |
| `trading_mode` | TEXT | `'paper'` or `'real'` |
| `kalshi_env` | TEXT | `'demo'` or `'production'` |
| `min_confidence_threshold` | INTEGER | 50-100, used by notifications + scanner filtering |
| `scan_interval_hours` | INTEGER | 1, 2, 4, 6, 12 |
| `push_enabled` | BOOLEAN | Toggle push notifications |
| `push_subscription` | JSONB | Web push subscription endpoint |
| `updated_at` | TIMESTAMPTZ | Last modified |

### API

- `GET /api/settings` — Returns the single settings row (creates with defaults if missing)
- `PUT /api/settings` — Partial update, debounced from the UI

### Behavior changes

- Settings page loads values from Supabase on mount, saves on change (debounced)
- `POST /api/bets` reads `trading_mode` from settings to determine paper vs real
- Cron scan reads `min_confidence_threshold` to filter recommendations
- API keys remain in `.env.local` (not in DB)

---

## 2. Mobile-Responsive Overhaul

### Sidebar to bottom tab bar

- `< 768px`: Hide left sidebar, show fixed bottom nav bar (56px, zinc-900 bg)
- `>= 768px`: Keep existing collapsible left sidebar
- Bottom bar: 6 icons (Dashboard, Markets, Bets, Analytics, Strategy, Settings) with tiny labels, active tab emerald-400

### Page-level responsive

- **Dashboard**: Stats cards stack vertically. Recommendation cards full-width. Larger touch targets (min 44px).
- **Markets**: Card grid 3-col to 1-col. Full-width search. Horizontal scrollable category chips.
- **Market Detail**: Stack orderbook below price info. Place Bet dialog becomes bottom sheet.
- **Bets**: Table switches to card layout on mobile. Larger tab touch targets.
- **Analytics**: Charts stack 1-col. Maintain minimum chart height.
- **Strategy**: Tighter spacing on mobile (already stacks at lg).
- **Settings**: Touch-friendly toggles and inputs.

### General rules

- All interactive elements: min 44px touch target
- No horizontal scrolling
- Text: no smaller than 12px
- Padding: px-3 on mobile, px-4 on desktop

---

## 3. One-Click "Execute AI Pick"

### Dashboard recommendation cards

- New "Execute" button alongside existing "Place Bet"
- Uses AI's recommended side + suggested size directly, no dialog
- Confirmation toast via Sonner: "Placed YES x 10 on KXHIGHNY... (paper)"
- Error toast on failure
- Reads `trading_mode` from settings

### Visual

- "Execute": solid emerald, compact, left of "Place Bet" (outline)
- Mobile: both buttons stack vertically, full-width
- Real mode: label becomes "Execute (Real $)" with red accent

### API

- No new endpoint. Uses existing `POST /api/bets` with recommendation values pre-filled.

---

## 4. Push Notifications (Lightweight)

### PWA setup

- `public/manifest.json` — app name, icons, theme color, `display: "standalone"`
- `public/sw.js` — minimal service worker for push events
- Service worker registration in root layout (client-side)

### VAPID keys

- Generate key pair, add to `.env.local`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client)
- `VAPID_PRIVATE_KEY` (server)

### Subscription flow

- Settings page: "Enable Push Notifications" toggle
- On: request browser permission, subscribe, store subscription in settings table
- Off: unsubscribe, clear subscription

### Push triggers

1. **High-confidence pick** — In cron scan, after storing a recommendation with confidence >= threshold, send push: "New pick: {title} — {confidence}% confidence"
2. **Bet resolved** — In cron resolve, after resolving a bet, send push: "Bet resolved: {market} — {HIT/MISS} for {+/-$X.XX}"

### Implementation

- `web-push` npm package for sending from API routes
- Each push logged in existing `alerts` table (type, title, body, sentAt)

---

## Priority Order

1. Functional Settings (foundation — other features depend on it)
2. Mobile-Responsive Overhaul (highest user impact — phone is primary device)
3. One-Click Execute (convenience, builds on settings)
4. Push Notifications (nice-to-have, layered on top)
