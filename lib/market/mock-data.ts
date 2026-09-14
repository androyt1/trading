import type { CandlestickData, Time } from "lightweight-charts";

/**
 * Static placeholder data for the dashboard shell, seeded from the real
 * BTC-USD match message captured during Milestone 0's Coinbase probe.
 * Replaced by live data from MarketSocketProvider once the WS pipeline
 * (Milestones 2-3) is wired up end to end.
 */
export interface MockSymbol {
  symbol: string;
  label: string;
  price: number;
  changePct: number;
}

export const MOCK_SYMBOLS: MockSymbol[] = [
  { symbol: "BTC-USD", label: "BTC/USD", price: 77912.33, changePct: 1.84 },
  { symbol: "ETH-USD", label: "ETH/USD", price: 3184.5, changePct: -0.62 },
  { symbol: "SOL-USD", label: "SOL/USD", price: 168.24, changePct: 3.15 },
];

export function generateMockCandles(
  basePrice: number,
  count = 90
): CandlestickData<Time>[] {
  const candles: CandlestickData<Time>[] = [];
  const now = Math.floor(Date.now() / 1000);
  const intervalSeconds = 60;
  let price = basePrice * 0.985;

  for (let i = count; i >= 0; i--) {
    const open = price;
    const drift =
      (Math.sin(i * 0.35) + (pseudoRandom(i) - 0.5)) * basePrice * 0.0015;
    const close = Math.max(open + drift, basePrice * 0.9);
    const high = Math.max(open, close) + pseudoRandom(i + 1) * basePrice * 0.0008;
    const low = Math.min(open, close) - pseudoRandom(i + 2) * basePrice * 0.0008;
    price = close;

    candles.push({
      time: (now - i * intervalSeconds) as Time,
      open,
      high,
      low,
      close,
    });
  }

  return candles;
}

export interface MockLevel {
  price: number;
  size: number;
}

export function generateMockBook(
  midPrice: number
): { bids: MockLevel[]; asks: MockLevel[] } {
  const tick = midPrice * 0.0004;
  const bids: MockLevel[] = [];
  const asks: MockLevel[] = [];

  for (let i = 1; i <= 10; i++) {
    bids.push({
      price: midPrice - tick * i,
      size: pseudoRandom(i * 3) * 2 + 0.05,
    });
    asks.push({
      price: midPrice + tick * i,
      size: pseudoRandom(i * 7) * 2 + 0.05,
    });
  }

  return { bids, asks };
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 999.7) * 10000;
  return x - Math.floor(x);
}
