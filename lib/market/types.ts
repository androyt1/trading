export interface NormalizedTick {
  symbol: string;
  price: number;
  size: number;
  side: "buy" | "sell";
  tradeId: number;
  timeMs: number;
}
