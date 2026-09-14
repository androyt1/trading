import type { NormalizedTick } from "../market/types";
import type { BackoffOptions } from "./backoff";
import { createCoalescer } from "./coalescer";
import { createUpstream, type ConnectionStatus, type UpstreamSocketLike } from "./upstream";

export interface HubClientSocket {
  send(data: string): void;
}

export interface CreateHubOptions {
  symbols: string[];
  connect: () => UpstreamSocketLike;
  now: () => number;
  scheduleTimer: (fn: () => void, delayMs: number) => void;
  staleTimeoutMs: number;
  tradeStaleTimeoutMs: number;
  backoff: BackoffOptions;
}

interface OrderMessage {
  type: "order";
  symbol: string;
  side: "buy" | "sell";
  qty: number;
}

function parseOrderMessage(raw: string): OrderMessage | null {
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof message !== "object" || message === null) return null;
  const candidate = message as Record<string, unknown>;
  if (candidate.type !== "order") return null;
  if (typeof candidate.symbol !== "string") return null;
  if (candidate.side !== "buy" && candidate.side !== "sell") return null;
  if (typeof candidate.qty !== "number" || candidate.qty <= 0) return null;
  return {
    type: "order",
    symbol: candidate.symbol,
    side: candidate.side,
    qty: candidate.qty,
  };
}

interface RegisteredClient {
  symbols: Set<string>;
  coalescer: ReturnType<typeof createCoalescer>;
}

export function createHub(options: CreateHubOptions) {
  const clients = new Map<HubClientSocket, RegisteredClient>();
  const lastTickBySymbol = new Map<string, NormalizedTick>();
  const lastTickReceivedAtBySymbol = new Map<string, number>();
  let status: ConnectionStatus = "connecting";

  const upstream = createUpstream({
    symbols: options.symbols,
    connect: options.connect,
    now: options.now,
    scheduleTimer: options.scheduleTimer,
    staleTimeoutMs: options.staleTimeoutMs,
    backoff: options.backoff,
    onTick: (tick) => {
      lastTickBySymbol.set(tick.symbol, tick);
      lastTickReceivedAtBySymbol.set(tick.symbol, options.now());
      for (const client of clients.values()) {
        if (client.symbols.has(tick.symbol)) {
          client.coalescer.push(tick);
        }
      }
    },
    onStatus: (s) => {
      status = s;
      for (const socket of clients.keys()) {
        socket.send(JSON.stringify({ type: "status", status }));
      }
    },
  });

  function registerClient(socket: HubClientSocket, symbols: string[]) {
    const coalescer = createCoalescer({
      onFlush: (ticks) => {
        socket.send(JSON.stringify({ type: "ticks", data: ticks }));
      },
    });
    clients.set(socket, { symbols: new Set(symbols), coalescer });

    const snapshotTicks = symbols
      .map((symbol) => lastTickBySymbol.get(symbol))
      .filter((tick): tick is NormalizedTick => Boolean(tick));
    socket.send(JSON.stringify({ type: "snapshot", data: snapshotTicks, status }));
  }

  function unregisterClient(socket: HubClientSocket) {
    clients.delete(socket);
  }

  function handleClientMessage(socket: HubClientSocket, raw: string) {
    const order = parseOrderMessage(raw);
    if (!order) return;

    const client = clients.get(socket);
    if (!client || !client.symbols.has(order.symbol)) {
      socket.send(JSON.stringify({ type: "rejected", reason: "not subscribed" }));
      return;
    }

    const tick = lastTickBySymbol.get(order.symbol);
    const receivedAt = lastTickReceivedAtBySymbol.get(order.symbol);
    const isStale =
      !tick || receivedAt === undefined || options.now() - receivedAt > options.tradeStaleTimeoutMs;
    if (isStale) {
      socket.send(JSON.stringify({ type: "rejected", reason: "stale price" }));
      return;
    }

    socket.send(
      JSON.stringify({
        type: "fill",
        symbol: order.symbol,
        side: order.side,
        qty: order.qty,
        price: tick.price,
        timeMs: options.now(),
      })
    );
  }

  function flushAll() {
    for (const client of clients.values()) {
      client.coalescer.flush();
    }
  }

  function start() {
    upstream.start();
  }

  return {
    registerClient,
    unregisterClient,
    handleClientMessage,
    flushAll,
    start,
    checkWatchdog: upstream.checkWatchdog,
  };
}
