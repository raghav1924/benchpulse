import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { calculatePercentile, computeLatencyMetrics, buildHistogram, evaluateSla } from '../core/stats.js';

describe('Stats Module', () => {
  it('should calculate percentiles accurately on sorted arrays', () => {
    const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const p50 = calculatePercentile(latencies, 50);
    const p90 = calculatePercentile(latencies, 90);
    const p99 = calculatePercentile(latencies, 99);

    assert.strictEqual(p50, 55);
    assert.strictEqual(p90, 91);
    assert.strictEqual(p99, 99.1);
  });

  it('should handle edge cases in percentiles (single element or empty)', () => {
    assert.strictEqual(calculatePercentile([], 50), 0);
    assert.strictEqual(calculatePercentile([42], 99), 42);
    assert.strictEqual(calculatePercentile([10, 20], 0), 10);
    assert.strictEqual(calculatePercentile([10, 20], 100), 20);
  });

  it('should compute comprehensive latency metrics', () => {
    const samples = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
    const metrics = computeLatencyMetrics(samples);

    assert.strictEqual(metrics.min, 10);
    assert.strictEqual(metrics.max, 28);
    assert.strictEqual(metrics.mean, 19);
    assert.ok(metrics.stddev > 0);
    assert.strictEqual(metrics.p50, 19);
    assert.ok(metrics.p99 > metrics.p50);
  });

  it('should build 10-bucket histogram with correct percentage distribution', () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1); // 1 to 100
    const histogram = buildHistogram(samples, 10);

    assert.strictEqual(histogram.length, 10);
    const totalCount = histogram.reduce((acc, b) => acc + b.count, 0);
    assert.strictEqual(totalCount, 100);

    const totalPct = histogram.reduce((acc, b) => acc + b.percentage, 0);
    assert.ok(totalPct >= 99 && totalPct <= 101);
  });

  it('should accurately evaluate SLA thresholds', () => {
    const metrics = {
      min: 5,
      max: 120,
      mean: 25,
      stddev: 10,
      p50: 20,
      p75: 30,
      p90: 45,
      p95: 55,
      p99: 95,
      p99_9: 110,
    };

    // Passing SLA
    const passResult = evaluateSla(metrics, 1500, 0.1, {
      maxP99Ms: 100,
      minRps: 1000,
      maxErrorRatePct: 1.0,
    });
    assert.strictEqual(passResult.passed, true);
    assert.strictEqual(passResult.failures.length, 0);

    // Failing SLA on p99 and minRps
    const failResult = evaluateSla(metrics, 800, 0.1, {
      maxP99Ms: 80,
      minRps: 1000,
    });
    assert.strictEqual(failResult.passed, false);
    assert.strictEqual(failResult.failures.length, 2);
  });
});
