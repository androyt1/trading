import { useCallback, useRef, useState } from "react";

export interface UseRenderedTickBufferOptions {
  scheduleFrame?: (callback: () => void) => number;
  cancelFrame?: (handle: number) => void;
}

function defaultScheduleFrame(callback: () => void): number {
  if (typeof requestAnimationFrame !== "undefined") {
    return requestAnimationFrame(callback);
  }
  return setTimeout(callback, 16) as unknown as number;
}

export function useRenderedTickBuffer<T extends { symbol: string }>(
  options: UseRenderedTickBufferOptions = {}
) {
  const scheduleFrame = options.scheduleFrame ?? defaultScheduleFrame;
  const pendingRef = useRef(new Map<string, T>());
  const frameScheduledRef = useRef(false);
  const [latestBySymbol, setLatestBySymbol] = useState<Record<string, T>>({});

  const push = useCallback(
    (tick: T) => {
      pendingRef.current.set(tick.symbol, tick);
      if (frameScheduledRef.current) return;

      frameScheduledRef.current = true;
      scheduleFrame(() => {
        frameScheduledRef.current = false;
        const updates = pendingRef.current;
        pendingRef.current = new Map();
        setLatestBySymbol((prev) => ({ ...prev, ...Object.fromEntries(updates) }));
      });
    },
    [scheduleFrame]
  );

  return { latestBySymbol, push };
}
