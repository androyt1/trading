"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { nextBackoffDelayMs, type BackoffOptions } from "@/lib/hub/backoff";
import { computePositions, type Fill, type Position } from "@/lib/pnl/calc";
import type { NormalizedTick } from "@/lib/market/types";
import { useRenderedTickBuffer } from "@/hooks/use-rendered-tick-buffer";

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

interface MarketSocketContextValue {
  status: ConnectionStatus;
  latestBySymbol: Record<string, NormalizedTick>;
  messagesReceived: number;
  positions: Record<string, Position>;
  lastRejection: string | null;
  sendOrder: (symbol: string, side: "buy" | "sell", qty: number) => void;
}

const MarketSocketContext = createContext<MarketSocketContextValue | null>(null);

export interface MarketSocketLike {
  addEventListener(
    type: "open" | "message" | "close",
    listener: (event: { data?: string }) => void
  ): void;
  send(data: string): void;
  close(): void;
}

const DEFAULT_BACKOFF: BackoffOptions = { baseMs: 500, maxMs: 15_000, jitterMs: 300 };

function defaultConnect(): MarketSocketLike {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return new WebSocket(`${protocol}//${window.location.host}/api/ws`);
}

export interface MarketSocketProviderProps {
  children: ReactNode;
  connect?: () => MarketSocketLike;
  backoff?: BackoffOptions;
  scheduleFrame?: (callback: () => void) => number;
  cancelFrame?: (handle: number) => void;
}

export function MarketSocketProvider({
  children,
  connect = defaultConnect,
  backoff = DEFAULT_BACKOFF,
  scheduleFrame,
  cancelFrame,
}: MarketSocketProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [messagesReceived, setMessagesReceived] = useState(0);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [lastRejection, setLastRejection] = useState<string | null>(null);
  const { latestBySymbol, push } = useRenderedTickBuffer<NormalizedTick>({
    scheduleFrame,
    cancelFrame,
  });
  const attemptRef = useRef(0);
  const stoppedRef = useRef(false);
  const socketRef = useRef<MarketSocketLike | null>(null);
  const fillsRef = useRef<Fill[]>([]);

  useEffect(() => {
    stoppedRef.current = false;

    function open() {
      const socket = connect();
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        attemptRef.current = 0;
      });

      socket.addEventListener("message", (event) => {
        setMessagesReceived((count) => count + 1);
        const message = JSON.parse(event.data ?? "{}");

        if (message.type === "snapshot") {
          setStatus(message.status ?? "connecting");
          for (const tick of message.data ?? []) push(tick);
        } else if (message.type === "status") {
          setStatus(message.status);
        } else if (message.type === "ticks") {
          for (const tick of message.data ?? []) push(tick);
        } else if (message.type === "fill") {
          fillsRef.current = [
            ...fillsRef.current,
            { symbol: message.symbol, side: message.side, qty: message.qty, price: message.price },
          ];
          setPositions(computePositions(fillsRef.current));
        } else if (message.type === "rejected") {
          setLastRejection(message.reason ?? "rejected");
        }
      });

      socket.addEventListener("close", () => {
        if (stoppedRef.current) return;
        setStatus("reconnecting");
        const delay = nextBackoffDelayMs(attemptRef.current, backoff);
        attemptRef.current += 1;
        setTimeout(() => {
          if (!stoppedRef.current) open();
        }, delay);
      });
    }

    open();

    return () => {
      stoppedRef.current = true;
      socketRef.current?.close();
    };
  }, [connect, backoff, push]);

  const sendOrder = useCallback((symbol: string, side: "buy" | "sell", qty: number) => {
    socketRef.current?.send(JSON.stringify({ type: "order", symbol, side, qty }));
  }, []);

  return (
    <MarketSocketContext.Provider
      value={{ status, latestBySymbol, messagesReceived, positions, lastRejection, sendOrder }}
    >
      {children}
    </MarketSocketContext.Provider>
  );
}

export function useMarketSocket(): MarketSocketContextValue {
  const context = useContext(MarketSocketContext);
  if (!context) {
    throw new Error("useMarketSocket must be used within a MarketSocketProvider");
  }
  return context;
}
