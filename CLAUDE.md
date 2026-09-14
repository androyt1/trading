# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm install
vercel dev              # local dev — NOT `next dev` (see below, this will silently fail for the WS route)
npm run build
npm run lint
npx tsc --noEmit         # type-check
npm run test              # full test suite (vitest run)
npx vitest run <path>      # a single test file
npx vitest run -t "<name>"  # a single test by name
```

Deploy: `vercel deploy --yes` (preview) or `vercel deploy --prod --yes` (production). The project is already linked (`.vercel/project.json`); a fresh clone needs `vercel link` first, which requires an interactive `vercel login`.

## Why `vercel dev`, not `next dev`

The WebSocket route (`app/api/ws/route.ts`) uses `@vercel/functions`' `experimental_upgradeWebSocket()`, which requires `ctx.upgradeWebSocket` injected by a real Vercel runtime. This does not exist under plain `next dev` — a raw upgrade request never reaches the route handler at all (confirmed empirically, not just from docs). `vercel dev` works because the Vercel CLI ships a dev-time preload shim that patches Node's `http.Server` to inject it. Everything that isn't the WS route itself works fine under plain `next dev`.

## Architecture: the market-data hub

The core of this app is a real-time pipeline, not the trading UI. Data flows in one direction through a fixed pipeline, and every stage that touches I/O or time takes it as an injected parameter (`connect`, `now`, `scheduleTimer`) specifically so it can be unit-tested with fakes instead of a real socket/clock — see `lib/hub/test-support/fake-socket.ts` and the `setup()` helpers at the top of each `*.test.ts` file for the pattern to follow when extending this code.

```
Coinbase public feed (wss://ws-feed.exchange.coinbase.com, "matches" channel)
  → lib/hub/upstream.ts   connect/subscribe/watchdog-reconnect/backoff to the exchange
  → lib/hub/hub.ts        per-client subscription filtering, order validation+fills, snapshot-on-connect
  → lib/hub/coalescer.ts  per-connection Map<symbol,latestTick>, flushed on one shared interval
  → app/api/ws/route.ts   the actual Vercel Function; a thin adapter only — all logic lives in lib/hub
  → components/providers/market-socket-provider.tsx   browser WS client, reconnect, sendOrder()
  → hooks/use-rendered-tick-buffer.ts   rAF-batched buffer: one setState per animation frame, not per message
  → dashboard components
```

Points that aren't obvious from reading any single file in that chain:

- **No cross-instance shared state.** Vercel Fluid Compute gives no guarantee that two connections land on the same function instance, so `hub.ts`'s in-memory state (`lastTickBySymbol`, connected clients) is per-instance, not global. Each instance that gets a connection opens its own independent upstream connection to Coinbase.
- **Trades execute over the WebSocket, not a REST endpoint**, specifically because of the point above: the "current price" only exists in the memory of whichever instance holds that client's connection. A separate `POST` could land on a different instance with no access to it. `hub.ts`'s `handleClientMessage` is invoked directly from the same connection's `message` event in `route.ts`.
- **A client-supplied price is parsed and discarded, never trusted** — `handleClientMessage` always fills at the server's own `lastTickBySymbol` price.
- **Coinbase's `level2` (order book) channel requires auth now**; only `matches` (trade prints) is free/unauthenticated. The order book UI is therefore not part of the live pipeline — it's still static mock data (`lib/market/mock-data.ts`). If wiring it up, use the free REST snapshot (`/products/{id}/book?level=2`) polled server-side, not a WS subscription.
- **Coalescing, not dropping**: `coalescer.ts` overwrites a `Map<symbol, tick>` on every upstream tick and flushes once per shared interval (~100ms, set in `route.ts`) — this is what caps outbound message rate regardless of upstream burst rate. Anomaly/fill/status messages bypass this map and send immediately.
- **`lib/pnl/calc.ts`** implements weighted-average cost basis with add/reduce/close/flip-through-zero handling, but deliberately does not track realized P&L (only unrealized, against the live mark price) — that's a known, documented simplification, not a bug to "fix" without discussing scope first.
- **No persistence.** `MarketSocketProvider` rebuilds `positions` client-side from `fill` messages received during the current session (via `computePositions`); nothing survives a page refresh. There is no database in this project yet.
