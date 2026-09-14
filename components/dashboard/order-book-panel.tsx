import { formatPrice } from "@/lib/format";
import type { MockLevel } from "@/lib/market/mock-data";

export function OrderBookPanel({
  bids,
  asks,
}: {
  bids: MockLevel[];
  asks: MockLevel[];
}) {
  const maxSize = Math.max(...bids.map((b) => b.size), ...asks.map((a) => a.size));
  const spread = asks[0] && bids[0] ? (asks[0].price + bids[0].price) / 2 : 0;

  return (
    <div className="flex h-full flex-col border border-terminal-border bg-terminal-panel">
      <div className="border-b border-terminal-border px-3 py-2 text-[10px] tracking-[0.2em] text-terminal-fg-dim">
        ORDER BOOK
      </div>
      <div className="flex flex-col-reverse">
        {asks
          .slice()
          .reverse()
          .map((level, i) => (
            <BookRow key={`ask-${i}`} level={level} side="ask" maxSize={maxSize} />
          ))}
      </div>
      <div className="border-y border-terminal-border-bright bg-terminal-panel-raised px-3 py-1.5 text-center tabular-nums text-sm font-semibold text-terminal-amber">
        {formatPrice(spread)}
      </div>
      <div className="flex flex-col">
        {bids.map((level, i) => (
          <BookRow key={`bid-${i}`} level={level} side="bid" maxSize={maxSize} />
        ))}
      </div>
    </div>
  );
}

function BookRow({
  level,
  side,
  maxSize,
}: {
  level: MockLevel;
  side: "bid" | "ask";
  maxSize: number;
}) {
  const pct = (level.size / maxSize) * 100;
  const barClass = side === "bid" ? "bg-terminal-green-dim/25" : "bg-terminal-red-dim/25";
  const textClass = side === "bid" ? "text-terminal-green" : "text-terminal-red";

  return (
    <div className="relative flex justify-between px-3 py-1 text-xs">
      <div
        className={`absolute inset-y-0 right-0 ${barClass}`}
        style={{ width: `${pct}%` }}
      />
      <span className={`relative tabular-nums ${textClass}`}>
        {formatPrice(level.price)}
      </span>
      <span className="relative tabular-nums text-terminal-fg-dim">
        {level.size.toFixed(4)}
      </span>
    </div>
  );
}
