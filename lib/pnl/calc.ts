export interface Fill {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
}

export interface Position {
  symbol: string;
  qty: number;
  avgPrice: number;
}

export function computePositions(fills: Fill[]): Record<string, Position> {
  const positions: Record<string, Position> = {};

  for (const fill of fills) {
    const current = positions[fill.symbol] ?? {
      symbol: fill.symbol,
      qty: 0,
      avgPrice: 0,
    };
    positions[fill.symbol] = applyFill(current, fill);
  }

  for (const symbol of Object.keys(positions)) {
    if (positions[symbol].qty === 0) delete positions[symbol];
  }

  return positions;
}

function applyFill(position: Position, fill: Fill): Position {
  const signedQty = fill.side === "buy" ? fill.qty : -fill.qty;
  const sameDirection = position.qty === 0 || Math.sign(position.qty) === Math.sign(signedQty);

  if (sameDirection) {
    const newQty = position.qty + signedQty;
    const newAvgPrice =
      newQty === 0
        ? 0
        : (position.qty * position.avgPrice + signedQty * fill.price) / newQty;
    return { symbol: fill.symbol, qty: newQty, avgPrice: newAvgPrice };
  }

  const newQty = position.qty + signedQty;
  const stillSameDirectionOrFlat = newQty === 0 || Math.sign(newQty) === Math.sign(position.qty);

  if (stillSameDirectionOrFlat) {
    return { symbol: fill.symbol, qty: newQty, avgPrice: newQty === 0 ? 0 : position.avgPrice };
  }

  return { symbol: fill.symbol, qty: newQty, avgPrice: fill.price };
}

export function computeUnrealizedPnl(position: Position, markPrice: number): number {
  return (markPrice - position.avgPrice) * position.qty;
}
