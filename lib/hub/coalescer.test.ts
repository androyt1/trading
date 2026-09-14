import { describe, expect, test, vi } from "vitest";
import { createCoalescer } from "./coalescer";
import type { NormalizedTick } from "../market/types";

function tick(overrides: Partial<NormalizedTick> = {}): NormalizedTick {
  return {
    symbol: "BTC-USD",
    price: 100,
    size: 1,
    side: "buy",
    tradeId: 1,
    timeMs: 0,
    ...overrides,
  };
}

describe("createCoalescer", () => {
  test("flush does nothing when nothing has been pushed", () => {
    const onFlush = vi.fn();
    const coalescer = createCoalescer({ onFlush });

    coalescer.flush();

    expect(onFlush).not.toHaveBeenCalled();
  });

  test("flush sends the single pushed tick", () => {
    const onFlush = vi.fn();
    const coalescer = createCoalescer({ onFlush });

    coalescer.push(tick({ symbol: "BTC-USD", price: 100 }));
    coalescer.flush();

    expect(onFlush).toHaveBeenCalledWith([tick({ symbol: "BTC-USD", price: 100 })]);
  });

  test("multiple pushes for the same symbol coalesce to only the latest value", () => {
    const onFlush = vi.fn();
    const coalescer = createCoalescer({ onFlush });

    coalescer.push(tick({ symbol: "BTC-USD", price: 100 }));
    coalescer.push(tick({ symbol: "BTC-USD", price: 101 }));
    coalescer.push(tick({ symbol: "BTC-USD", price: 102 }));
    coalescer.flush();

    expect(onFlush).toHaveBeenCalledWith([tick({ symbol: "BTC-USD", price: 102 })]);
  });

  test("different symbols are kept distinct in the same flush", () => {
    const onFlush = vi.fn();
    const coalescer = createCoalescer({ onFlush });

    coalescer.push(tick({ symbol: "BTC-USD", price: 100 }));
    coalescer.push(tick({ symbol: "ETH-USD", price: 50 }));
    coalescer.flush();

    expect(onFlush).toHaveBeenCalledWith([
      tick({ symbol: "BTC-USD", price: 100 }),
      tick({ symbol: "ETH-USD", price: 50 }),
    ]);
  });

  test("flushing clears pending state so an empty flush afterwards does nothing", () => {
    const onFlush = vi.fn();
    const coalescer = createCoalescer({ onFlush });

    coalescer.push(tick());
    coalescer.flush();
    coalescer.flush();

    expect(onFlush).toHaveBeenCalledTimes(1);
  });
});
