// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MarketSocketProvider, useMarketSocket } from "./market-socket-provider";
import { FakeSocket } from "@/lib/hub/test-support/fake-socket";

function TestConsumer() {
  const { status, latestBySymbol, messagesReceived, positions, lastRejection, sendOrder } =
    useMarketSocket();
  const btcPosition = positions["BTC-USD"];
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="messages">{messagesReceived}</span>
      <span data-testid="btc-price">{latestBySymbol["BTC-USD"]?.price ?? "none"}</span>
      <span data-testid="btc-qty">{btcPosition?.qty ?? "none"}</span>
      <span data-testid="btc-avg">{btcPosition?.avgPrice ?? "none"}</span>
      <span data-testid="rejection">{lastRejection ?? "none"}</span>
      <button onClick={() => sendOrder("BTC-USD", "buy", 2)}>buy</button>
    </div>
  );
}

function setup() {
  const sockets: FakeSocket[] = [];
  const frameCallbacks: Array<() => void> = [];

  const connect = () => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  };

  const scheduleFrame = (cb: () => void) => {
    frameCallbacks.push(cb);
    return frameCallbacks.length;
  };

  render(
    <MarketSocketProvider
      connect={connect}
      backoff={{ baseMs: 10, maxMs: 100, jitterMs: 0 }}
      scheduleFrame={scheduleFrame}
      cancelFrame={() => {}}
    >
      <TestConsumer />
    </MarketSocketProvider>
  );

  function flushFrames() {
    const callbacks = frameCallbacks.splice(0, frameCallbacks.length);
    act(() => {
      callbacks.forEach((cb) => cb());
    });
  }

  return { sockets, flushFrames };
}

describe("MarketSocketProvider", () => {
  test("starts in connecting status with no data", () => {
    setup();
    expect(screen.getByTestId("status").textContent).toBe("connecting");
    expect(screen.getByTestId("btc-price").textContent).toBe("none");
  });

  test("applies the status carried on a snapshot message", () => {
    const { sockets } = setup();

    act(() => {
      sockets[0].emitOpen();
      sockets[0].emitMessage({ type: "snapshot", data: [], status: "live" });
    });

    expect(screen.getByTestId("status").textContent).toBe("live");
  });

  test("ticks carried on a snapshot populate latestBySymbol once the frame flushes", () => {
    const { sockets, flushFrames } = setup();

    act(() => {
      sockets[0].emitOpen();
      sockets[0].emitMessage({
        type: "snapshot",
        status: "live",
        data: [{ symbol: "BTC-USD", price: 100, size: 1, side: "buy", tradeId: 1, timeMs: 0 }],
      });
    });
    expect(screen.getByTestId("btc-price").textContent).toBe("none");

    flushFrames();
    expect(screen.getByTestId("btc-price").textContent).toBe("100");
  });

  test("a status message updates status directly", () => {
    const { sockets } = setup();

    act(() => {
      sockets[0].emitMessage({ type: "status", status: "reconnecting" });
    });

    expect(screen.getByTestId("status").textContent).toBe("reconnecting");
  });

  test("counts every message received", () => {
    const { sockets } = setup();

    act(() => {
      sockets[0].emitMessage({ type: "status", status: "live" });
      sockets[0].emitMessage({ type: "status", status: "live" });
    });

    expect(screen.getByTestId("messages").textContent).toBe("2");
  });

  test("closing the socket marks the connection reconnecting and opens a new one after backoff", () => {
    vi.useFakeTimers();
    const { sockets } = setup();

    act(() => {
      sockets[0].emitClose();
    });
    expect(screen.getByTestId("status").textContent).toBe("reconnecting");
    expect(sockets).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(sockets).toHaveLength(2);

    vi.useRealTimers();
  });

  test("sendOrder sends an order message over the current socket", () => {
    const { sockets } = setup();

    act(() => {
      fireEvent.click(screen.getByText("buy"));
    });

    expect(sockets[0].sent).toEqual([
      JSON.stringify({ type: "order", symbol: "BTC-USD", side: "buy", qty: 2 }),
    ]);
  });

  test("a fill message updates the position for that symbol", () => {
    const { sockets } = setup();

    act(() => {
      sockets[0].emitMessage({ type: "fill", symbol: "BTC-USD", side: "buy", qty: 2, price: 100 });
    });

    expect(screen.getByTestId("btc-qty").textContent).toBe("2");
    expect(screen.getByTestId("btc-avg").textContent).toBe("100");
  });

  test("multiple fills accumulate into the position", () => {
    const { sockets } = setup();

    act(() => {
      sockets[0].emitMessage({ type: "fill", symbol: "BTC-USD", side: "buy", qty: 2, price: 100 });
      sockets[0].emitMessage({ type: "fill", symbol: "BTC-USD", side: "buy", qty: 2, price: 120 });
    });

    expect(screen.getByTestId("btc-qty").textContent).toBe("4");
    expect(screen.getByTestId("btc-avg").textContent).toBe("110");
  });

  test("a rejected message exposes the rejection reason", () => {
    const { sockets } = setup();

    act(() => {
      sockets[0].emitMessage({ type: "rejected", reason: "stale price" });
    });

    expect(screen.getByTestId("rejection").textContent).toBe("stale price");
  });
});
