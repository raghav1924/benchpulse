import { LatencyMetrics, HistogramBucket, SlaCriteria } from './types.js';

export function calculatePercentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  if (p <= 0) return sortedValues[0];
  if (p >= 100) return sortedValues[sortedValues.length - 1];

  const rank = (p / 100) * (sortedValues.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  const weight = rank - lowerIndex;

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const val = sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
  return Number(val.toFixed(3));
}

export function computeLatencyMetrics(latencies: number[]): LatencyMetrics {
  if (latencies.length === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      stddev: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      p9_9: 0,
    } as any;
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const count = sorted.length;
  const min = sorted[0];
  const max = sorted[count - 1];
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = Number((sum / count).toFixed(3));

  const varianceSum = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
  const stddev = Number(Math.sqrt(varianceSum / count).toFixed(3));

  return {
    min: Number(min.toFixed(3)),
    max: Number(max.toFixed(3)),
    mean,
    stddev,
    p50: calculatePercentile(sorted, 50),
    p75: calculatePercentile(sorted, 75),
    p90: calculatePercentile(sorted, 90),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
    p99_9: calculatePercentile(sorted, 99.9),
  };
}

export function buildHistogram(latencies: number[], bucketCount: number = 10): HistogramBucket[] {
  if (latencies.length === 0) return [];
  const sorted = [...latencies].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  if (min === max) {
    return [
      {
        bottomMs: min,
        topMs: max,
        count: sorted.length,
        percentage: 100,
        bar: '■'.repeat(30),
      },
    ];
  }

  const step = (max - min) / bucketCount;
  const buckets: HistogramBucket[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bottom = Number((min + i * step).toFixed(2));
    const top = Number((min + (i + 1) * step).toFixed(2));
    buckets.push({
      bottomMs: bottom,
      topMs: top,
      count: 0,
      percentage: 0,
      bar: '',
    });
  }

  for (const lat of sorted) {
    let index = Math.floor((lat - min) / step);
    if (index >= bucketCount) index = bucketCount - 1;
    if (index < 0) index = 0;
    buckets[index].count++;
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const total = sorted.length;

  for (const b of buckets) {
    b.percentage = Number(((b.count / total) * 100).toFixed(1));
    const barLength = Math.round((b.count / maxCount) * 30);
    b.bar = '■'.repeat(barLength) + ' '.repeat(Math.max(0, 30 - barLength));
  }

  return buckets;
}

export function evaluateSla(
  metrics: LatencyMetrics,
  rps: number,
  errorRate: number,
  criteria?: SlaCriteria
): { passed: boolean; failures: string[] } {
  if (!criteria) return { passed: true, failures: [] };
  const failures: string[] = [];

  if (criteria.maxP99Ms !== undefined && metrics.p99 > criteria.maxP99Ms) {
    failures.push(`p99 latency (${metrics.p99}ms) exceeded threshold (${criteria.maxP99Ms}ms)`);
  }
  if (criteria.maxMeanMs !== undefined && metrics.mean > criteria.maxMeanMs) {
    failures.push(`Mean latency (${metrics.mean}ms) exceeded threshold (${criteria.maxMeanMs}ms)`);
  }
  if (criteria.minRps !== undefined && rps < criteria.minRps) {
    failures.push(`Throughput (${rps.toFixed(1)} req/s) fell below required (${criteria.minRps} req/s)`);
  }
  if (criteria.maxErrorRatePct !== undefined && errorRate > criteria.maxErrorRatePct) {
    failures.push(`Error rate (${errorRate.toFixed(2)}%) exceeded ceiling (${criteria.maxErrorRatePct}%)`);
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}
