import { describe, expect, test } from "vitest";
import { nextBackoffDelayMs } from "./backoff";

describe("nextBackoffDelayMs", () => {
  test("returns the base delay on the first attempt", () => {
    const delay = nextBackoffDelayMs(0, {
      baseMs: 500,
      maxMs: 30000,
      jitterMs: 0,
    });

    expect(delay).toBe(500);
  });

  test("doubles the delay for each subsequent attempt", () => {
    expect(nextBackoffDelayMs(1, { baseMs: 500, maxMs: 30000, jitterMs: 0 })).toBe(1000);
    expect(nextBackoffDelayMs(2, { baseMs: 500, maxMs: 30000, jitterMs: 0 })).toBe(2000);
    expect(nextBackoffDelayMs(3, { baseMs: 500, maxMs: 30000, jitterMs: 0 })).toBe(4000);
  });

  test("caps the delay at maxMs", () => {
    const delay = nextBackoffDelayMs(20, { baseMs: 500, maxMs: 30000, jitterMs: 0 });

    expect(delay).toBe(30000);
  });

  test("adds up to jitterMs of random jitter on top of the base delay", () => {
    const delay = nextBackoffDelayMs(0, { baseMs: 500, maxMs: 30000, jitterMs: 200 });

    expect(delay).toBeGreaterThanOrEqual(500);
    expect(delay).toBeLessThanOrEqual(700);
  });
});
