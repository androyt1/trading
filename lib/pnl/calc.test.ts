import { describe, expect, test } from "vitest";
import { computePositions, computeUnrealizedPnl } from "./calc";

describe("computePositions", () => {
  test("a single buy opens a long position at the fill price", () => {
    const positions = computePositions([
      { symbol: "BTC-USD", side: "buy", qty: 2, price: 100 },
    ]);

    expect(positions["BTC-USD"]).toEqual({ symbol: "BTC-USD", qty: 2, avgPrice: 100 });
  });

  test("a second buy on the same side averages the entry price", () => {
    const positions = computePositions([
      { symbol: "BTC-USD", side: "buy", qty: 2, price: 100 },
      { symbol: "BTC-USD", side: "buy", qty: 2, price: 120 },
    ]);

    expect(positions["BTC-USD"]).toEqual({ symbol: "BTC-USD", qty: 4, avgPrice: 110 });
  });

  test("a partial sell reduces quantity without changing the average price", () => {
    const positions = computePositions([
      { symbol: "BTC-USD", side: "buy", qty: 5, price: 100 },
      { symbol: "BTC-USD", side: "sell", qty: 3, price: 90 },
    ]);

    expect(positions["BTC-USD"]).toEqual({ symbol: "BTC-USD", qty: 2, avgPrice: 100 });
  });

  test("selling the full quantity closes the position entirely", () => {
    const positions = computePositions([
      { symbol: "BTC-USD", side: "buy", qty: 5, price: 100 },
      { symbol: "BTC-USD", side: "sell", qty: 5, price: 90 },
    ]);

    expect(positions["BTC-USD"]).toBeUndefined();
  });

  test("selling more than the long position flips it to a short at the fill price", () => {
    const positions = computePositions([
      { symbol: "BTC-USD", side: "buy", qty: 5, price: 100 },
      { symbol: "BTC-USD", side: "sell", qty: 8, price: 90 },
    ]);

    expect(positions["BTC-USD"]).toEqual({ symbol: "BTC-USD", qty: -3, avgPrice: 90 });
  });

  test("tracks multiple symbols independently", () => {
    const positions = computePositions([
      { symbol: "BTC-USD", side: "buy", qty: 1, price: 100 },
      { symbol: "ETH-USD", side: "buy", qty: 10, price: 50 },
    ]);

    expect(positions["BTC-USD"]).toEqual({ symbol: "BTC-USD", qty: 1, avgPrice: 100 });
    expect(positions["ETH-USD"]).toEqual({ symbol: "ETH-USD", qty: 10, avgPrice: 50 });
  });
});

describe("computeUnrealizedPnl", () => {
  test("is positive when the mark price is above a long position's average price", () => {
    const pnl = computeUnrealizedPnl({ symbol: "BTC-USD", qty: 2, avgPrice: 100 }, 120);
    expect(pnl).toBe(40);
  });

  test("is negative when the mark price is below a long position's average price", () => {
    const pnl = computeUnrealizedPnl({ symbol: "BTC-USD", qty: 2, avgPrice: 100 }, 90);
    expect(pnl).toBe(-20);
  });

  test("is positive when the mark price falls below a short position's average price", () => {
    const pnl = computeUnrealizedPnl({ symbol: "BTC-USD", qty: -2, avgPrice: 100 }, 90);
    expect(pnl).toBe(20);
  });
});
