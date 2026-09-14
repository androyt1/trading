"use client";

import type { CandlestickData, Time } from "lightweight-charts";
import {
  MarketSocketProvider,
  useMarketSocket,
} from "@/components/providers/market-socket-provider";
import { MOCK_SYMBOLS, type MockLevel } from "@/lib/market/mock-data";
import { ConnectionStatusBadge } from "./connection-status-badge";
import { MetricsReadout } from "./metrics-readout";
import { OrderBookPanel } from "./order-book-panel";
import { PositionsPanel } from "./positions-panel";
import { PriceChart } from "./price-chart";
import { TickerTape } from "./ticker-tape";
import { TradeTicket } from "./trade-ticket";

interface LiveDashboardProps {
  initialCandles: CandlestickData<Time>[];
  book: { bids: MockLevel[]; asks: MockLevel[] };
}

export function LiveDashboard(props: LiveDashboardProps) {
  return (
    <MarketSocketProvider>
      <DashboardContent {...props} />
    </MarketSocketProvider>
  );
}

function DashboardContent({ initialCandles, book }: LiveDashboardProps) {
  const { status, latestBySymbol, messagesReceived, positions, lastRejection, sendOrder } =
    useMarketSocket();
  const primary = MOCK_SYMBOLS[0];
  const badgeStatus = status === "connecting" ? "reconnecting" : status;
  const isLive = status === "live";

  const tickerItems = MOCK_SYMBOLS.map((mock) => {
    const live = latestBySymbol[mock.symbol];
    return {
      symbol: mock.symbol,
      label: mock.label,
      price: live?.price ?? mock.price,
      changePct: mock.changePct,
    };
  });

  const positionRows = Object.values(positions).map((position) => ({
    symbol: position.symbol,
    qty: position.qty,
    avgPrice: position.avgPrice,
    markPrice: latestBySymbol[position.symbol]?.price ?? position.avgPrice,
  }));

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border border-terminal-border bg-terminal-panel px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-bold tracking-[0.3em] text-terminal-amber">
            TRADER
          </h1>
          <span className="text-[10px] tracking-[0.15em] text-terminal-fg-faint">
            REAL-TIME PAPER TRADING TERMINAL
          </span>
        </div>
        <div className="flex items-center gap-4">
          <MetricsReadout messages={messagesReceived} />
          <ConnectionStatusBadge status={badgeStatus} />
        </div>
      </header>

      <p className="border border-terminal-border-bright bg-terminal-panel-raised px-4 py-2 text-xs text-terminal-fg-dim">
        Ticker, connection status, and paper trading stream live over the
        WebSocket hub — orders fill at the server&apos;s latest known price,
        never a client-supplied one. Chart and order book are still static
        placeholders.
      </p>

      <TickerTape items={tickerItems} />

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="border border-terminal-border bg-terminal-panel p-2">
          <PriceChart data={initialCandles} />
        </div>
        <OrderBookPanel bids={book.bids} asks={book.asks} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <PositionsPanel positions={positionRows} />
        <TradeTicket
          symbol={primary.symbol}
          disabled={!isLive}
          rejection={lastRejection}
          onSubmit={(side, qty) => sendOrder(primary.symbol, side, qty)}
        />
      </div>
    </div>
  );
}
