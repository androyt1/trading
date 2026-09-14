export interface RollingStatsOptions {
  windowSize: number;
  zScoreThreshold: number;
}

export interface RollingStatsResult {
  isAnomaly: boolean;
  zScore: number;
  mean: number;
  stdDev: number;
}

export function createRollingStats(options: RollingStatsOptions) {
  const window: number[] = [];

  function push(price: number): RollingStatsResult {
    const isFull = window.length >= options.windowSize;
    const mean = average(window);
    const stdDev = standardDeviation(window, mean);
    const zScore =
      stdDev === 0 ? (price === mean ? 0 : Infinity) : Math.abs(price - mean) / stdDev;
    const isAnomaly = isFull && zScore > options.zScoreThreshold;

    window.push(price);
    if (window.length > options.windowSize) {
      window.shift();
    }

    return { isAnomaly, zScore, mean, stdDev };
  }

  return { push };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function standardDeviation(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
