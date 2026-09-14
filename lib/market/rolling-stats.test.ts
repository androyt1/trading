import { describe, expect, test } from "vitest";
import { createRollingStats } from "./rolling-stats";

describe("createRollingStats", () => {
  test("does not flag an anomaly while the window is still filling up", () => {
    const stats = createRollingStats({ windowSize: 5, zScoreThreshold: 3 });

    const result = stats.push(100);

    expect(result.isAnomaly).toBe(false);
  });

  test("does not flag a price close to the recent mean", () => {
    const stats = createRollingStats({ windowSize: 5, zScoreThreshold: 3 });
    for (const price of [100, 101, 99, 100, 100]) {
      stats.push(price);
    }

    const result = stats.push(101);

    expect(result.isAnomaly).toBe(false);
  });

  test("flags a price that is a large jump from a tight recent window", () => {
    const stats = createRollingStats({ windowSize: 5, zScoreThreshold: 3 });
    for (const price of [100, 100, 100, 100, 100]) {
      stats.push(price);
    }

    const result = stats.push(200);

    expect(result.isAnomaly).toBe(true);
    expect(result.zScore).toBeGreaterThan(3);
  });
});
