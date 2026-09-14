import { describe, expect, test, vi } from "vitest";
import { createUpstream } from "./upstream";
import { FakeSocket } from "./test-support/fake-socket";

const MATCH = {
  type: "match",
  trade_id: 1,
  side: "buy",
  size: "0.5",
  price: "100",
  product_id: "BTC-USD",
  time: "2026-01-01T00:00:00.000000Z",
};

function setup(overrides: Partial<Parameters<typeof createUpstream>[0]> = {}) {
  const sockets: FakeSocket[] = [];
  const timers: Array<{ fn: () => void; delayMs: number }> = [];
  const onTick = vi.fn();
  const onStatus = vi.fn();
  let now = 0;

  const upstream = createUpstream({
    symbols: ["BTC-USD"],
    connect: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    now: () => now,
    scheduleTimer: (fn, delayMs) => {
      timers.push({ fn, delayMs });
    },
    staleTimeoutMs: 10_000,
    backoff: { baseMs: 1000, maxMs: 30_000, jitterMs: 0 },
    onTick,
    onStatus,
    ...overrides,
  });

  return {
    upstream,
    sockets,
    timers,
    onTick,
    onStatus,
    advanceTime: (ms: number) => {
      now += ms;
    },
  };
}

describe("createUpstream", () => {
  test("subscribes to the given symbols once the socket opens", () => {
    const { upstream, sockets } = setup();

    upstream.start();
    sockets[0].emitOpen();

    expect(sockets[0].sent).toEqual([
      JSON.stringify({
        type: "subscribe",
        product_ids: ["BTC-USD"],
        channels: ["matches"],
      }),
    ]);
  });

  test("normalizes match messages and forwards them via onTick", () => {
    const { upstream, sockets, onTick } = setup();

    upstream.start();
    sockets[0].emitOpen();
    sockets[0].emitMessage(MATCH);

    expect(onTick).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "BTC-USD", price: 100, side: "buy" })
    );
  });

  test("ignores non-match message types", () => {
    const { upstream, sockets, onTick } = setup();

    upstream.start();
    sockets[0].emitOpen();
    sockets[0].emitMessage({ type: "subscriptions", channels: [] });

    expect(onTick).not.toHaveBeenCalled();
  });

  test("reports connecting, then live, then reconnecting on a subsequent attempt", () => {
    const { upstream, sockets, onStatus } = setup();

    upstream.start();
    expect(onStatus).toHaveBeenLastCalledWith("connecting");
    sockets[0].emitOpen();
    expect(onStatus).toHaveBeenLastCalledWith("live");

    sockets[0].emitClose();
    expect(onStatus).toHaveBeenLastCalledWith("reconnecting");
  });

  test("schedules a backoff reconnect after the socket closes, and resubscribes on the new connection", () => {
    const { upstream, sockets, timers } = setup();

    upstream.start();
    sockets[0].emitOpen();
    sockets[0].emitClose();

    expect(timers).toHaveLength(1);
    expect(timers[0].delayMs).toBe(1000);

    timers[0].fn();
    expect(sockets).toHaveLength(2);
    sockets[1].emitOpen();
    expect(sockets[1].sent).toHaveLength(1);
  });

  test("checkWatchdog does nothing while messages are still fresh", () => {
    const { upstream, sockets, advanceTime, timers } = setup();

    upstream.start();
    sockets[0].emitOpen();
    advanceTime(5000);
    upstream.checkWatchdog();

    expect(sockets[0].closed).toBe(false);
    expect(timers).toHaveLength(0);
  });

  test("checkWatchdog force-reconnects when no message has arrived within staleTimeoutMs", () => {
    const { upstream, sockets, advanceTime, timers } = setup();

    upstream.start();
    sockets[0].emitOpen();
    advanceTime(10_001);
    upstream.checkWatchdog();

    expect(sockets[0].closed).toBe(true);
    expect(timers).toHaveLength(1);
  });

  test("a stale close event for an already-superseded socket does not schedule a second reconnect", () => {
    const { upstream, sockets, advanceTime, timers } = setup();

    upstream.start();
    sockets[0].emitOpen();
    advanceTime(10_001);
    upstream.checkWatchdog();
    expect(timers).toHaveLength(1);

    // the old socket's close event arrives late, after the watchdog already reconnected
    sockets[0].emitClose();

    expect(timers).toHaveLength(1);
  });
});
