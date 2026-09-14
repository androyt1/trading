import type { NormalizedTick } from "./types";

interface RawCoinbaseMatch {
  type: "match" | "last_match";
  trade_id: number;
  side: "buy" | "sell";
  size: string;
  price: string;
  product_id: string;
  time: string;
}

export function normalizeMatch(raw: RawCoinbaseMatch): NormalizedTick {
  return {
    symbol: raw.product_id,
    price: Number(raw.price),
    size: Number(raw.size),
    side: raw.side,
    tradeId: raw.trade_id,
    timeMs: Date.parse(raw.time),
  };
}
