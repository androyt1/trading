import { describe, expect, test } from "vitest";
import { normalizeMatch } from "./normalize";

describe("normalizeMatch", () => {
  test("converts a Coinbase match message into a NormalizedTick", () => {
    const raw = {
      type: "match" as const,
      trade_id: 1092468184,
      maker_order_id: "f5418168-4149-4d6c-a1c5-10894315c2fc",
      taker_order_id: "54b9d185-4d16-41f7-ab4f-314ef66f155e",
      side: "buy" as const,
      size: "0.00000003",
      price: "77912.33",
      product_id: "BTC-USD",
      sequence: 136057438654,
      time: "2026-09-14T10:34:47.559992Z",
    };

    const tick = normalizeMatch(raw);

    expect(tick).toEqual({
      symbol: "BTC-USD",
      price: 77912.33,
      size: 0.00000003,
      side: "buy",
      tradeId: 1092468184,
      timeMs: Date.parse("2026-09-14T10:34:47.559992Z"),
    });
  });

  test("treats a last_match message the same as a match message", () => {
    const raw = {
      type: "last_match" as const,
      trade_id: 1,
      maker_order_id: "a",
      taker_order_id: "b",
      side: "sell" as const,
      size: "1.5",
      price: "100",
      product_id: "ETH-USD",
      sequence: 1,
      time: "2026-01-01T00:00:00.000000Z",
    };

    const tick = normalizeMatch(raw);

    expect(tick.symbol).toBe("ETH-USD");
    expect(tick.side).toBe("sell");
  });
});
