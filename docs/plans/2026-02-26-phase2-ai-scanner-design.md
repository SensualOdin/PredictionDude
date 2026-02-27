# Phase 2: AI Scanner — Design Document

**Date**: 2026-02-26
**Status**: Approved
**Phase**: 2 of 5 (PRD reference: kalshi-ai-trader-prd.md)

## Goal

Transform PredictionDude from a static market viewer into an active AI-powered scanner that analyzes markets with real-time web data, tracks historical performance, and displays live recommendations on the dashboard.

## What Exists (Phase 1)

- AI Engine (`src/lib/ai/engine.ts`) — Claude analysis with JSON extraction, but no web search and empty external context
- Cron/scan route — fetches markets, filters by strategy, runs AI analysis, stores recommendations
- Cron/resolve route — checks settled markets, updates bets with P&L
- Recommendations API (GET + POST) — working
- Dashboard — static shell with hardcoded "no data" states
- Kalshi client — all endpoints implemented
- Drizzle schema — all 6 tables migrated to Supabase

## Design

### 1. AI Engine — Web Search Integration

Update `src/lib/ai/engine.ts` to use Anthropic's built-in web search tool.

- Add `web_search_20250305` tool with `max_uses: 3` to the `analyzeMarket()` call
- Claude autonomously decides what to search based on market category/title (news, weather, economic data)
- Update system prompt to inform Claude it has web search capability
- Handle new response format: iterate content blocks, extract JSON from final text block (after search results)
- No changes to `analyzeOutcome()`

Cost control: `max_uses: 3` per market caps at ~$0.03/market. At 30 eligible markets per scan, 6 scans/day = ~$5.40/day.

**Eliminated**: Entire `src/lib/external/` module (News API, OpenWeather, FRED clients) — not needed.

### 2. Historical Performance Helper

New file: `src/lib/ai/performance.ts`

- `getHistoricalPerformance(category: string)` queries bets table:
  - Win rate for category (hits / total resolved)
  - Confidence calibration (avg confidence of wins vs losses)
  - Total bets in category
- Returns formatted string for AI prompt's `historical_performance` parameter
- Returns "No historical data yet" when insufficient data exists

### 3. Dashboard Data Integration

Install `@tanstack/react-query` for server state with 30s polling.

New API routes:
- `GET /api/stats` — aggregates from bets: win_rate, total_pnl, active_count, current_streak
- `GET /api/bets` — query bets with filters (status, mode)

Dashboard page updates:
- Stats cards → `/api/stats`
- Today's Picks → `/api/recommendations` (existing)
- Active Bets → `/api/bets?status=open`
- All use React Query with `refetchInterval: 30000`

### 4. Cron/Scan Enhancements

- Pass `getHistoricalPerformance(category)` to AI engine
- Remove empty `external_context` param (web search replaces it)
- Add `CRON_SECRET` auth: verify `Authorization: Bearer <secret>` header if env var set, skip check if not set

### 5. Deliverables

| Deliverable | Files |
|---|---|
| Web search in AI engine | `src/lib/ai/engine.ts`, `src/lib/ai/prompts.ts` |
| Historical performance | `src/lib/ai/performance.ts` |
| React Query setup | `src/lib/providers.tsx`, `package.json` |
| Stats API route | `src/app/api/stats/route.ts` |
| Bets API route | `src/app/api/bets/route.ts` |
| Live dashboard | `src/app/page.tsx` |
| Cron auth | `src/app/api/cron/scan/route.ts` |
