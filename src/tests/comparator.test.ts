import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { compareRuns } from '../core/comparator.js';
import { BenchmarkResult } from '../core/types.js';

describe('Benchmark Comparator', () => {
  const baseResult: BenchmarkResult = {
    id: 'base-1',
    targetUrl: 'http://127.0.0.1:8899',
    method: 'GET',
    timestamp: new Date().toISOString(),
    durationMs: 5000,
    concurrency: 10,
    totalRequests: 1000,
    successfulRequests: 1000,
    failedRequests: 0,
    errorRate: 0,
    rps: 200,
    throughputBytesPerSec: 50000,
    totalBytes: 250000,
    latency: {
      min: 2,
      max: 40,
      mean: 10,
      stddev: 3,
      p50: 8,
      p75: 12,
      p90: 16,
      p95: 20,
      p99: 25,
      p99_9: 35,
    },
    histogram: [],
    statusCodes: { '200': 1000 },
    errors: {},
  };

  it('should detect performance regression when p99 latency spikes', () => {
    const regressedRun: BenchmarkResult = {
      ...baseResult,
      id: 'target-regressed',
      latency: {
        ...baseResult.latency,
        p99: 45, // +80% increase
      },
    };

    const diff = compareRuns(baseResult, regressedRun);
    assert.strictEqual(diff.verdict, 'REGRESSED');
    assert.strictEqual(diff.p99ChangePct, 80);
  });

  it('should detect improvement when throughput increases and tail drops', () => {
    const improvedRun: BenchmarkResult = {
      ...baseResult,
      id: 'target-improved',
      rps: 260, // +30%
      latency: {
        ...baseResult.latency,
        p99: 18, // -28%
      },
    };

    const diff = compareRuns(baseResult, improvedRun);
    assert.strictEqual(diff.verdict, 'IMPROVED');
    assert.strictEqual(diff.rpsChangePct, 30);
  });
});
