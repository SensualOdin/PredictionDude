# Phase 3: Betting & Tracking — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable paper and real bet placement from AI recommendations, wire up markets and bets pages with live data, and create a market detail page.

**Architecture:** A POST /api/bets endpoint handles bet placement for both paper (DB-only) and real (Kalshi API + DB) modes. The markets page fetches live data from the Kalshi API proxy. The bets page uses React Query with tab-based filtering. A PlaceBetDialog component provides a reusable bet placement form triggered from recommendations or market detail.

**Tech Stack:** Next.js 16, Drizzle ORM, React Query, Kalshi API, shadcn/ui (Dialog, Form components)

---

### Task 1: POST /api/bets route for bet placement

**Files:**
- Modify: `src/app/api/bets/route.ts` (add POST handler alongside existing GET)

**What:** Accept `{ marketTicker, side, contracts, entryPrice, mode, recommendationId? }`. For paper mode: insert into bets table. For real mode: call `kalshi.placeOrder()` first, then insert with kalshiOrderId. Calculate totalCost = entryPrice * contracts. Return the created bet.

---

### Task 2: Markets page with live data

**Files:**
- Modify: `src/app/markets/page.tsx` (full rewrite)

**What:** Use React Query to fetch `/api/markets?status=open&limit=100`. Display market cards in a grid with: title, YES price as percentage, volume, category badge, time until close. Support search filtering and category tab filtering (client-side). Link each card to `/markets/[ticker]`.

---

### Task 3: Market detail page

**Files:**
- Create: `src/app/markets/[ticker]/page.tsx`

**What:** Fetch market data from `/api/markets/[ticker]`, orderbook from a new endpoint or inline fetch. Show market title, current YES/NO prices, volume, close time, orderbook summary. Include "Analyze with AI" button (POST /api/recommendations) and PlaceBetDialog.

---

### Task 4: Bet placement dialog component

**Files:**
- Create: `src/components/place-bet-dialog.tsx`

**What:** shadcn Dialog with form: side toggle (YES/NO), contracts input, mode toggle (Paper/Real), entry price display. On submit: POST /api/bets. Show success/error state. Trigger from dashboard recommendations and market detail.

---

### Task 5: Bets page with live data

**Files:**
- Modify: `src/app/bets/page.tsx` (full rewrite)

**What:** React Query fetches `/api/bets` with query params based on active tab and filters. Active tab -> `status=open`, Resolved tab -> resolved bets (won/lost), All tab -> no filter. Mode and category filters. Display in table with market, side, entry price, result/current, P&L, status badges.

---

## Execution Summary

| Task | What | Files |
|------|------|-------|
| 1 | POST /api/bets | `api/bets/route.ts` |
| 2 | Markets page live data | `markets/page.tsx` |
| 3 | Market detail page | `markets/[ticker]/page.tsx` |
| 4 | Bet placement dialog | `components/place-bet-dialog.tsx` |
| 5 | Bets page live data | `bets/page.tsx` |
