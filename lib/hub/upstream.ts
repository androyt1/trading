import { normalizeMatch } from "../market/normalize";
import type { NormalizedTick } from "../market/types";
import { nextBackoffDelayMs, type BackoffOptions } from "./backoff";

export interface UpstreamSocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(
    type: "open" | "message" | "close",
    listener: (event: { data?: string }) => void
  ): void;
}

export type ConnectionStatus = "connecting" | "live" | "reconnecting";

export interface CreateUpstreamOptions {
  symbols: string[];
  connect: () => UpstreamSocketLike;
  now: () => number;
  scheduleTimer: (fn: () => void, delayMs: number) => void;
  staleTimeoutMs: number;
  backoff: BackoffOptions;
  onTick: (tick: NormalizedTick) => void;
  onStatus: (status: ConnectionStatus) => void;
}

export function createUpstream(options: CreateUpstreamOptions) {
  let socket: UpstreamSocketLike | null = null;
  let generation = 0;
  let lastMessageAt = options.now();
  let attempt = 0;
  let started = false;

  function open() {
    const myGeneration = ++generation;
    if (attempt === 0) options.onStatus("connecting");

    const s = options.connect();
    socket = s;

    s.addEventListener("open", () => {
      if (myGeneration !== generation) return;
      attempt = 0;
      lastMessageAt = options.now();
      s.send(
        JSON.stringify({
          type: "subscribe",
          product_ids: options.symbols,
          channels: ["matches"],
        })
      );
      options.onStatus("live");
    });

    s.addEventListener("message", (event) => {
      if (myGeneration !== generation) return;
      lastMessageAt = options.now();
      const raw = JSON.parse(event.data ?? "{}");
      if (raw.type === "match" || raw.type === "last_match") {
        options.onTick(normalizeMatch(raw));
      }
    });

    s.addEventListener("close", () => {
      if (myGeneration !== generation) return;
      handleDisconnect();
    });
  }

  function handleDisconnect() {
    if (!started) return;
    options.onStatus("reconnecting");
    const delay = nextBackoffDelayMs(attempt, options.backoff);
    attempt += 1;
    options.scheduleTimer(() => {
      if (started) open();
    }, delay);
  }

  function start() {
    started = true;
    open();
  }

  function stop() {
    started = false;
    generation++;
    socket?.close();
  }

  function checkWatchdog() {
    if (!started || !socket) return;
    if (options.now() - lastMessageAt > options.staleTimeoutMs) {
      generation++;
      socket.close();
      handleDisconnect();
    }
  }

  return { start, stop, checkWatchdog };
}
