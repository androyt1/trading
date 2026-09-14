import { formatPrice } from "@/lib/format";

export interface Position {
  symbol: string;
  qty: number;
  avgPrice: number;
  markPrice: number;
}

export function PositionsPanel({ positions }: { positions: Position[] }) {
  return (
    <div className="flex flex-col border border-terminal-border bg-terminal-panel">
      <div className="border-b border-terminal-border px-3 py-2 text-[10px] tracking-[0.2em] text-terminal-fg-dim">
        POSITIONS
      </div>
      {positions.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-terminal-fg-faint">
          No open positions — place a paper trade to open one.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-terminal-fg-dim">
              <th className="px-3 py-1.5 text-left font-normal">SYMBOL</th>
              <th className="px-3 py-1.5 text-right font-normal">QTY</th>
              <th className="px-3 py-1.5 text-right font-normal">AVG</th>
              <th className="px-3 py-1.5 text-right font-normal">MARK</th>
              <th className="px-3 py-1.5 text-right font-normal">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const pnl = (position.markPrice - position.avgPrice) * position.qty;
              const positive = pnl >= 0;
              return (
                <tr key={position.symbol} className="border-t border-terminal-border">
                  <td className="px-3 py-1.5">{position.symbol}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{position.qty}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatPrice(position.avgPrice)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatPrice(position.markPrice)}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right tabular-nums ${
                      positive ? "text-terminal-green" : "text-terminal-red"
                    }`}
                  >
                    {positive ? "+" : ""}
                    {formatPrice(pnl)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
