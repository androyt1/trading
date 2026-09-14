// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRenderedTickBuffer } from "./use-rendered-tick-buffer";

interface TestTick {
  symbol: string;
  price: number;
}

function setup() {
  const frameCallbacks: Array<() => void> = [];
  const scheduleFrame = vi.fn((cb: () => void) => {
    frameCallbacks.push(cb);
    return frameCallbacks.length;
  });
  const cancelFrame = vi.fn();

  const rendered = renderHook(() =>
    useRenderedTickBuffer<TestTick>({ scheduleFrame, cancelFrame })
  );

  function flush() {
    const callbacks = frameCallbacks.splice(0, frameCallbacks.length);
    act(() => {
      callbacks.forEach((cb) => cb());
    });
  }

  return { rendered, scheduleFrame, flush };
}

describe("useRenderedTickBuffer", () => {
  test("starts with an empty latestBySymbol map", () => {
    const { rendered } = setup();
    expect(rendered.result.current.latestBySymbol).toEqual({});
  });

  test("pushing a tick does not update state until the scheduled frame runs", () => {
    const { rendered, flush } = setup();

    act(() => {
      rendered.result.current.push({ symbol: "BTC-USD", price: 100 });
    });
    expect(rendered.result.current.latestBySymbol).toEqual({});

    flush();
    expect(rendered.result.current.latestBySymbol).toEqual({
      "BTC-USD": { symbol: "BTC-USD", price: 100 },
    });
  });

  test("multiple pushes for the same symbol before a flush collapse to the latest value", () => {
    const { rendered, flush } = setup();

    act(() => {
      rendered.result.current.push({ symbol: "BTC-USD", price: 100 });
      rendered.result.current.push({ symbol: "BTC-USD", price: 101 });
      rendered.result.current.push({ symbol: "BTC-USD", price: 102 });
    });
    flush();

    expect(rendered.result.current.latestBySymbol["BTC-USD"]).toEqual({
      symbol: "BTC-USD",
      price: 102,
    });
  });

  test("multiple pushes before a flush only schedule a single frame", () => {
    const { rendered, scheduleFrame, flush } = setup();

    act(() => {
      rendered.result.current.push({ symbol: "BTC-USD", price: 100 });
      rendered.result.current.push({ symbol: "ETH-USD", price: 50 });
      rendered.result.current.push({ symbol: "BTC-USD", price: 101 });
    });
    flush();

    expect(scheduleFrame).toHaveBeenCalledTimes(1);
  });

  test("a push after a flush schedules a new frame", () => {
    const { rendered, scheduleFrame, flush } = setup();

    act(() => {
      rendered.result.current.push({ symbol: "BTC-USD", price: 100 });
    });
    flush();
    act(() => {
      rendered.result.current.push({ symbol: "BTC-USD", price: 200 });
    });

    expect(scheduleFrame).toHaveBeenCalledTimes(2);
  });

  test("does not throw when requestAnimationFrame is unavailable (e.g. during SSR)", () => {
    const original = globalThis.requestAnimationFrame;
    // @ts-expect-error simulating a server environment where this global doesn't exist
    delete globalThis.requestAnimationFrame;

    try {
      expect(() => renderHook(() => useRenderedTickBuffer<TestTick>())).not.toThrow();
    } finally {
      globalThis.requestAnimationFrame = original;
    }
  });

  test("preserves ticks for other symbols across flushes", () => {
    const { rendered, flush } = setup();

    act(() => {
      rendered.result.current.push({ symbol: "BTC-USD", price: 100 });
    });
    flush();
    act(() => {
      rendered.result.current.push({ symbol: "ETH-USD", price: 50 });
    });
    flush();

    expect(rendered.result.current.latestBySymbol).toEqual({
      "BTC-USD": { symbol: "BTC-USD", price: 100 },
      "ETH-USD": { symbol: "ETH-USD", price: 50 },
    });
  });
});
