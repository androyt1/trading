import { describe, expect, test, vi } from "vitest";
import { createHub } from "./hub";
import { FakeSocket } from "./test-support/fake-socket";

const MATCH_BTC = {
  type: "match",
  trade_id: 1,
  side: "buy",
  size: "0.5",
  price: "100",
  product_id: "BTC-USD",
  time: "2026-01-01T00:00:00.000000Z",
};

const MATCH_ETH = {
  type: "match",
  trade_id: 2,
  side: "sell",
  size: "2",
  price: "50",
  product_id: "ETH-USD",
  time: "2026-01-01T00:00:01.000000Z",
};

function fakeClient() {
  return { send: vi.fn() };
}

function setup() {
  const upstreamSockets: FakeSocket[] = [];
  let now = 0;

  const hub = createHub({
    symbols: ["BTC-USD", "ETH-USD"],
    connect: () => {
      const s = new FakeSocket();
      upstreamSockets.push(s);
      return s;
    },
    now: () => now,
    scheduleTimer: () => {},
    staleTimeoutMs: 10_000,
    tradeStaleTimeoutMs: 5000,
    backoff: { baseMs: 1000, maxMs: 30_000, jitterMs: 0 },
  });

  hub.start();
  upstreamSockets[0].emitOpen();

  return { hub, upstreamSockets, advanceTime: (ms: number) => (now += ms) };
}

function messagesOf(client: { send: ReturnType<typeof vi.fn> }) {
  return client.send.mock.calls.map(([data]) => JSON.parse(data as string));
}

describe("createHub", () => {
  test("sends an immediate snapshot message when a client registers", () => {
    const { hub } = setup();
    const client = fakeClient();

    hub.registerClient(client, ["BTC-USD"]);

    const messages = messagesOf(client);
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("snapshot");
  });

  test("a snapshot includes the latest known tick for a subscribed symbol that already has data", () => {
    const { hub, upstreamSockets } = setup();
    upstreamSockets[0].emitMessage(MATCH_BTC);

    const client = fakeClient();
    hub.registerClient(client, ["BTC-USD"]);

    const [snapshot] = messagesOf(client);
    expect(snapshot.data).toEqual([expect.objectContaining({ symbol: "BTC-USD", price: 100 })]);
  });

  test("fans out flushed ticks only to clients subscribed to that symbol", () => {
    const { hub, upstreamSockets } = setup();
    const btcClient = fakeClient();
    const ethClient = fakeClient();
    hub.registerClient(btcClient, ["BTC-USD"]);
    hub.registerClient(ethClient, ["ETH-USD"]);

    upstreamSockets[0].emitMessage(MATCH_BTC);
    upstreamSockets[0].emitMessage(MATCH_ETH);
    hub.flushAll();

    const btcMessages = messagesOf(btcClient);
    const ethMessages = messagesOf(ethClient);

    expect(btcMessages.at(-1)).toEqual({
      type: "ticks",
      data: [expect.objectContaining({ symbol: "BTC-USD" })],
    });
    expect(ethMessages.at(-1)).toEqual({
      type: "ticks",
      data: [expect.objectContaining({ symbol: "ETH-USD" })],
    });
  });

  test("multiple ticks for the same symbol before a flush coalesce into a single ticks message", () => {
    const { hub, upstreamSockets } = setup();
    const client = fakeClient();
    hub.registerClient(client, ["BTC-USD"]);

    upstreamSockets[0].emitMessage(MATCH_BTC);
    upstreamSockets[0].emitMessage({ ...MATCH_BTC, price: "101" });
    upstreamSockets[0].emitMessage({ ...MATCH_BTC, price: "102" });
    hub.flushAll();

    const messages = messagesOf(client);
    const tickMessages = messages.filter((m) => m.type === "ticks");
    expect(tickMessages).toHaveLength(1);
    expect(tickMessages[0].data).toEqual([expect.objectContaining({ price: 102 })]);
  });

  test("does not send a ticks message on flush when nothing new arrived", () => {
    const { hub } = setup();
    const client = fakeClient();
    hub.registerClient(client, ["BTC-USD"]);

    hub.flushAll();

    const messages = messagesOf(client);
    expect(messages.filter((m) => m.type === "ticks")).toHaveLength(0);
  });

  test("broadcasts status changes to all registered clients", () => {
    const { hub, upstreamSockets } = setup();
    const client = fakeClient();
    hub.registerClient(client, ["BTC-USD"]);

    upstreamSockets[0].emitClose();

    const messages = messagesOf(client);
    expect(messages.at(-1)).toEqual({ type: "status", status: "reconnecting" });
  });

  test("an unregistered client stops receiving fanned-out ticks", () => {
    const { hub, upstreamSockets } = setup();
    const client = fakeClient();
    hub.registerClient(client, ["BTC-USD"]);
    hub.unregisterClient(client);

    upstreamSockets[0].emitMessage(MATCH_BTC);
    hub.flushAll();

    const messages = messagesOf(client);
    expect(messages.filter((m) => m.type === "ticks")).toHaveLength(0);
  });
});

describe("createHub order handling", () => {
  test("fills an order at the latest known price for a subscribed symbol", () => {
    const { hub, upstreamSockets } = setup();
    const client = fakeClient();
    hub.registerClient(client, ["BTC-USD"]);
    upstreamSockets[0].emitMessage(MATCH_BTC);

    hub.handleClientMessage(
      client,
      JSON.stringify({ type: "order", symbol: "BTC-USD", side: "buy", qty: 2 })
    );

    const messages = messagesOf(client);
    expect(messages.at(-1)).toEqual({
      type: "fill",
      symbol: "BTC-USD",
      side: "buy",
      qty: 2,
      price: 100,
      timeMs: expect.any(Number),
    });
  });

  test("rejects an order for a symbol the client isn't subscribed to", () => {
    const { hub, upstreamSockets } = setup();
    const client = fakeClient();
    hub.registerClient(client, ["BTC-USD"]);
    upstreamSockets[0].emitMessage(MATCH_ETH);

    hub.handleClientMessage(
      client,
      JSON.stringify({ type: "order", symbol: "ETH-USD", side: "buy", qty: 1 })
    );

    const messages = messagesOf(client);
    expect(messages.at(-1)).toEqual({ type: "rejected", reason: "not subscribed" });
  });

  test("rejects an order when no price has been received yet for the symbol", () => {
    const { hub } = setup();
    const client = fakeClient();
    hub.registerClient(client, ["BTC-USD"]);

    hub.handleClientMessage(
      client,
      JSON.stringify({ type: "order", symbol: "BTC-USD", side: "buy", qty: 1 })
    );

    const messages = messagesOf(client);
    expect(messages.at(-1)).toEqual({ type: "rejected", reason: "stale price" });
  });

  test("rejects an order once the price is older than the trade staleness window", () => {
    const { hub, upstreamSockets, advanceTime } = setup();
    const client = fakeClient();
    hub.registerClient(client, ["BTC-USD"]);
    upstreamSockets[0].emitMessage(MATCH_BTC);

    advanceTime(5001);
    hub.handleClientMessage(
      client,
      JSON.stringify({ type: "order", symbol: "BTC-USD", side: "buy", qty: 1 })
    );

    const messages = messagesOf(client);
    expect(messages.at(-1)).toEqual({ type: "rejected", reason: "stale price" });
  });

  test("ignores a malformed order message without throwing", () => {
    const { hub } = setup();
    const client = fakeClient();
    hub.registerClient(client, ["BTC-USD"]);

    expect(() => hub.handleClientMessage(client, "not json")).not.toThrow();
    expect(() =>
      hub.handleClientMessage(client, JSON.stringify({ type: "order", qty: -1 }))
    ).not.toThrow();
  });

  test("prices a fill from the client-supplied side and qty but never from a client-supplied price", () => {
    const { hub, upstreamSockets } = setup();
    const client = fakeClient();
    hub.registerClient(client, ["BTC-USD"]);
    upstreamSockets[0].emitMessage(MATCH_BTC);

    hub.handleClientMessage(
      client,
      JSON.stringify({ type: "order", symbol: "BTC-USD", side: "sell", qty: 3, price: 1 })
    );

    const messages = messagesOf(client);
    expect(messages.at(-1)).toEqual({
      type: "fill",
      symbol: "BTC-USD",
      side: "sell",
      qty: 3,
      price: 100,
      timeMs: expect.any(Number),
    });
  });
});
