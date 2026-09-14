import type { NormalizedTick } from "../market/types";

export interface CoalescerOptions {
  onFlush: (ticks: NormalizedTick[]) => void;
}

export function createCoalescer(options: CoalescerOptions) {
  const pending = new Map<string, NormalizedTick>();

  function push(tick: NormalizedTick) {
    pending.set(tick.symbol, tick);
  }

  function flush() {
    if (pending.size === 0) return;
    const ticks = Array.from(pending.values());
    pending.clear();
    options.onFlush(ticks);
  }

  return { push, flush };
}
