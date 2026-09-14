"use client";

import { useState } from "react";

export function TradeTicket({
  symbol,
  onSubmit,
  disabled,
  rejection,
}: {
  symbol: string;
  onSubmit: (side: "buy" | "sell", qty: number) => void;
  disabled: boolean;
  rejection: string | null;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("0.01");

  const parsedQty = Number(qty);
  const canSubmit = !disabled && Number.isFinite(parsedQty) && parsedQty > 0;

  return (
    <form
      className="flex flex-col gap-3 border border-terminal-border bg-terminal-panel p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit(side, parsedQty);
      }}
    >
      <div className="text-[10px] tracking-[0.2em] text-terminal-fg-dim">
        TRADE — {symbol}
      </div>
      <div className="flex gap-px overflow-hidden border border-terminal-border">
        <button
          type="button"
          onClick={() => setSide("buy")}
          className={`flex-1 py-1.5 text-xs font-semibold tracking-[0.2em] transition-colors ${
            side === "buy"
              ? "bg-terminal-green-dim/40 text-terminal-green"
              : "bg-terminal-panel-raised text-terminal-fg-dim"
          }`}
        >
          BUY
        </button>
        <button
          type="button"
          onClick={() => setSide("sell")}
          className={`flex-1 py-1.5 text-xs font-semibold tracking-[0.2em] transition-colors ${
            side === "sell"
              ? "bg-terminal-red-dim/40 text-terminal-red"
              : "bg-terminal-panel-raised text-terminal-fg-dim"
          }`}
        >
          SELL
        </button>
      </div>
      <label className="flex flex-col gap-1 text-[10px] tracking-[0.2em] text-terminal-fg-dim">
        QUANTITY
        <input
          type="number"
          step="any"
          min="0"
          value={qty}
          onChange={(event) => setQty(event.target.value)}
          className="border border-terminal-border bg-terminal-bg px-2 py-1.5 font-mono tabular-nums text-terminal-fg outline-none focus:border-terminal-amber"
        />
      </label>
      <button
        type="submit"
        disabled={!canSubmit}
        className="border border-terminal-border-bright bg-terminal-panel-raised py-2 text-xs font-semibold tracking-[0.2em] text-terminal-fg transition-colors enabled:hover:border-terminal-amber enabled:hover:text-terminal-amber disabled:cursor-not-allowed disabled:text-terminal-fg-faint"
      >
        {disabled ? "FEED NOT LIVE" : "EXECUTE"}
      </button>
      {rejection && (
        <p className="text-xs text-terminal-red">Last order rejected: {rejection}</p>
      )}
    </form>
  );
}
