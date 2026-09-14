# trader

A real-time crypto market data and paper-trading terminal. Live prices, a live order book feed, and simulated buy/sell execution — built to demonstrate real-time systems engineering: a custom WebSocket fan-out server, backpressure handling, reconnect logic, and server-authoritative trade execution over a live data pipeline.

**Live: https://trader-seven-pink.vercel.app**

Trading is simulated (paper trading) against real live prices from Coinbase's public market data feed — no real money, no brokerage integration, no signup.

## What this demonstrates

The interesting engineering problem here isn't the trading UI — it's what sits behind it: a server that holds one upstream connection to an exchange and safely fans it out to many browser clients, each getting only what they subscribed to, without falling behind or falling over when the upstream feed hiccups.

- **A single upstream connection, fanned out to N clients.** The server holds one WebSocket to Coinbase's public feed and multiplexes it to every connected browser, filtered per-client to the symbols that client actually subscribed to.
- **Backpressure via coalescing, not dropping.** Each client connection buffers incoming ticks in a `Map<symbol, latestTick>` and flushes once per ~100ms interval — a burst of 50 updates for one symbol in that window collapses to a single outbound message carrying the latest value, so a fast upstream feed can never overwhelm a client's render loop.
- **Two independent reconnect paths.** The upstream (server → Coinbase) leg uses a watchdog that force-reconnects if no message arrives within a timeout, even without a clean close event — the actual common failure mode. The downstream (browser → server) leg reconnects on `close`. Both use exponential backoff with jitter, and both resubscribe from scratch on reconnect, since neither side's subscriptions survive the old connection.
- **rAF-batched client rendering.** Incoming ticks write into a mutable ref, not React state, and a single `requestAnimationFrame` loop drains the buffer into one `setState` per frame — capping re-renders at the display refresh rate regardless of message rate.
- **Server-authoritative trade execution.** Paper trades are submitted over the same WebSocket connection the client is already subscribed on (not a separate REST call — see [why](#why-trades-execute-over-the-websocket-not-rest) below), validated for staleness, and filled at the server's last known price. A client-supplied price in the order payload is parsed and explicitly ignored.

## Real problems hit while building this (and how they got solved)

A few things broke or turned out not to work the way the plan assumed. Each one is a small case study in reading platform behavior instead of trusting assumptions:

- **Binance geo-blocks US-based server traffic.** The original plan assumed Binance's free public WebSocket feed. Vercel Functions run from US regions, and Binance's API blocks that. Switched to Coinbase Exchange's public feed instead — also free, also unauthenticated, not geo-blocked.
- **Coinbase's `level2` (order book) channel now requires auth.** Discovered by actually connecting and reading the error frame, not by trusting the docs. `matches` (trade prints) is still free and unauthenticated, so the live ticker and trading stay fully push-based; the order book falls back to polling Coinbase's free REST snapshot endpoint instead of a push stream.
- **`next dev` cannot serve a WebSocket upgrade route at all.** Verified empirically — a raw upgrade request never reaches the route handler under plain `next dev`. `experimental_upgradeWebSocket()` requires a real Vercel runtime. `vercel dev` works, because the Vercel CLI ships a dev-time preload shim (`next-dev-websocket.cjs`) that patches Node's `http.Server` to intercept upgrades before Next's dev server and inject the context object the upgrade helper expects — confirmed by reading the shim's source, not just its docs.
- **No shared memory across Vercel Function instances.** Fluid Compute doesn't guarantee two WebSocket connections land on the same instance, so there's no single global "the" upstream connection — each instance that receives a connection is self-sufficient and opens its own. This is a deliberate design choice, not a limitation worked around: it's also the reason trades execute over the WebSocket rather than a separate REST endpoint (see below), and it's the natural seam where a Redis pub/sub layer would go if this needed to scale to one shared fan-out point across instances.

### Why trades execute over the WebSocket, not REST

The "current price" a trade should fill at only exists in the memory of whichever Function instance is holding that client's WebSocket connection. A `POST /api/trades` REST call is a separate invocation — it can land on a *different* instance with no access to that price. Sending the order over the already-open, already-subscribed WebSocket connection guarantees it's handled by the instance that actually has the live price, with no extra round trip and no risk of pricing an order against stale or unavailable data.

## Architecture

```
Coinbase public feed (matches, live trades)
        │  one WebSocket per Function instance
        ▼
 lib/hub/upstream.ts   — connect, subscribe, watchdog-forced reconnect, backoff+jitter
        │  onTick
        ▼
 lib/hub/hub.ts        — per-client subscription filtering, order validation & fills,
        │                 snapshot-on-connect, status broadcast
        │  push (per connection)
        ▼
 lib/hub/coalescer.ts  — Map<symbol, latestTick>, flushed on one shared interval
        │  one WS message per flush
        ▼
 app/api/ws/route.ts   — the actual Vercel Function (experimental_upgradeWebSocket)
        │  wss://.../api/ws
        ▼
 MarketSocketProvider  — browser WS client, reconnect+backoff, sendOrder()
        │  push (rAF-batched, mutable ref)
        ▼
 useRenderedTickBuffer — one setState per animation frame
        │
        ▼
 Dashboard UI (ticker, positions, trade ticket — live; chart & order book — static for now)
```

## Tech stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript
- **`@vercel/functions`** `experimental_upgradeWebSocket()` — native WebSocket support on Vercel Fluid Compute, no separate WS server or host
- **Coinbase Exchange public market data** — free, unauthenticated, no API key
- **`lightweight-charts`** for the candlestick chart
- **Vitest** + **@testing-library/react** — 61 tests, TDD throughout (every test written and watched red before the implementation)
- **Tailwind CSS 4**, IBM Plex Mono

## Running locally

The WebSocket route only works under a real Vercel runtime — plain `next dev` cannot serve it (see above). Use the Vercel CLI's dev emulator instead:

```bash
npm install
vercel link      # one-time, needs a Vercel account
vercel dev
```

Then open http://localhost:3000.

```bash
npm run test        # run the test suite
npx tsc --noEmit     # type-check
npm run lint         # lint
```

## What's deliberately not built yet

- **No persistence.** Positions are rebuilt client-side from fills received during the current session — refreshing the page starts over. A `trades` table keyed by an anonymous session cookie was designed but deprioritized; it's a small, well-scoped addition on top of the existing fill events.
- **No anomaly/spike detection in the UI.** The rolling z-score detector (`lib/market/rolling-stats.ts`) is built and tested but not yet wired into the live tick pipeline.
- **Chart and order book are static placeholders.** The live ticker and trading prove the pipeline works; extending the same pattern to OHLC candle aggregation and the polled order book is the natural next step, not a different design.
- **Realized P&L isn't tracked** — only unrealized P&L against the current mark price. Closing/flipping a position resets cost basis correctly, but the P&L "locked in" by a closing trade isn't recorded anywhere.
