export interface BackoffOptions {
  baseMs: number;
  maxMs: number;
  jitterMs: number;
}

export function nextBackoffDelayMs(attempt: number, options: BackoffOptions): number {
  const exponential = options.baseMs * 2 ** attempt;
  const capped = Math.min(exponential, options.maxMs);
  const jitter = Math.random() * options.jitterMs;
  return Math.min(capped + jitter, options.maxMs + options.jitterMs);
}
