import { experimental_upgradeWebSocket } from "@vercel/functions";
import type { RawData } from "ws";
import { createHub } from "@/lib/hub/hub";

const SYMBOLS = ["BTC-USD", "ETH-USD", "SOL-USD"];
const COINBASE_WS_URL = "wss://ws-feed.exchange.coinbase.com";
const FLUSH_INTERVAL_MS = 100;
const WATCHDOG_INTERVAL_MS = 5000;
const STALE_TIMEOUT_MS = 10_000;
const TRADE_STALE_TIMEOUT_MS = 5000;

let hub: ReturnType<typeof createHub> | null = null;

function getHub() {
  if (!hub) {
    const instance = createHub({
      symbols: SYMBOLS,
      connect: () => new WebSocket(COINBASE_WS_URL),
      now: () => Date.now(),
      scheduleTimer: (fn, delayMs) => setTimeout(fn, delayMs),
      staleTimeoutMs: STALE_TIMEOUT_MS,
      tradeStaleTimeoutMs: TRADE_STALE_TIMEOUT_MS,
      backoff: { baseMs: 1000, maxMs: 30_000, jitterMs: 500 },
    });
    instance.start();
    setInterval(() => instance.flushAll(), FLUSH_INTERVAL_MS);
    setInterval(() => instance.checkWatchdog(), WATCHDOG_INTERVAL_MS);
    hub = instance;
  }
  return hub;
}

export async function GET() {
  return experimental_upgradeWebSocket((ws) => {
    const h = getHub();
    h.registerClient(ws, SYMBOLS);

    ws.on("message", (data: RawData) => {
      h.handleClientMessage(ws, data.toString());
    });

    ws.on("close", () => {
      h.unregisterClient(ws);
    });
  });
}
