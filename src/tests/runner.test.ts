import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { BenchmarkRunner } from '../core/runner.js';
import { MockHttpServer } from '../core/mock-server.js';
import { createVirtualTransport } from './test-utils.js';

describe('BenchmarkRunner Engine', () => {
  it('should run benchmark to completion with request limits and collect metrics', async () => {
    const mock = new MockHttpServer({ port: 9125, minDelayMs: 1, maxDelayMs: 3 });
    const transport = createVirtualTransport((req, res) => mock.handle(req, res));

    const runner = new BenchmarkRunner(
      {
        url: 'http://127.0.0.1:9125',
        concurrency: 4,
        totalRequests: 25,
      },
      undefined,
      transport
    );

    const result = await runner.run();

    assert.strictEqual(result.concurrency, 4);
    assert.strictEqual(result.totalRequests, 25);
    assert.strictEqual(result.successfulRequests, 25);
    assert.strictEqual(result.failedRequests, 0);
    assert.strictEqual(result.errorRate, 0);
    assert.ok(result.rps > 0);
    assert.ok(result.latency.p50 >= 0);
    assert.ok(result.latency.p99 >= result.latency.p50);
    assert.ok(result.histogram.length > 0);
  });

  it('should respect SLA assertions during benchmark runs', async () => {
    const mock = new MockHttpServer({ port: 9126, minDelayMs: 1, maxDelayMs: 2 });
    const transport = createVirtualTransport((req, res) => mock.handle(req, res));

    const runner = new BenchmarkRunner(
      {
        url: 'http://127.0.0.1:9126',
        concurrency: 2,
        totalRequests: 10,
      },
      {
        maxP99Ms: 200, // Should pass easily
        minRps: 1,
      },
      transport
    );

    const result = await runner.run();
    assert.strictEqual(result.passedSla, true);
    assert.strictEqual(result.slaFailures?.length, 0);
  });
});
