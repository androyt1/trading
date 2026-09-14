import { formatPrice } from "@/lib/format";

export interface TickerItem {
  symbol: string;
  label: string;
  price: number;
  changePct: number;
}

export function TickerTape({ items }: { items: TickerItem[] }) {
  return (
    <div className="flex gap-px overflow-x-auto border border-terminal-border bg-terminal-border">
      {items.map((item) => {
        const positive = item.changePct >= 0;
        return (
          <div
            key={item.symbol}
            className="flex min-w-[180px] flex-1 flex-col gap-1 bg-terminal-panel px-4 py-3"
          >
            <span className="text-[10px] tracking-[0.2em] text-terminal-fg-dim">
              {item.label}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums text-lg font-semibold text-terminal-fg">
                {formatPrice(item.price)}
              </span>
              <span
                className={`tabular-nums text-xs font-medium ${
                  positive ? "text-terminal-green" : "text-terminal-red"
                }`}
              >
                {positive ? "+" : ""}
                {item.changePct.toFixed(2)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
