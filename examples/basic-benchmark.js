import { BenchmarkRunner, MockHttpServer } from '../dist/index.js';

async function main() {
  console.log('⚡ Starting mock HTTP target...');
  const mock = new MockHttpServer({ port: 9988, minDelayMs: 3, maxDelayMs: 15 });
  const mockUrl = await mock.start();
  console.log(`Mock server active at: ${mockUrl}`);

  try {
    const runner = new BenchmarkRunner({
      url: mockUrl,
      concurrency: 15,
      durationSec: 5,
    });

    console.log('Running benchmark for 5 seconds with 15 concurrent workers...');
    const result = await runner.run((p) => {
      process.stdout.write(`\rCurrent RPS: ${p.currentRps} | Completed Reqs: ${p.completedRequests}   `);
    });

    console.log('\n\n--- Benchmark Completed ---');
    console.log(`Total Requests: ${result.totalRequests}`);
    console.log(`Throughput: ${result.rps} req/s`);
    console.log(`p50 Latency: ${result.latency.p50} ms`);
    console.log(`p95 Latency: ${result.latency.p95} ms`);
    console.log(`p99 Latency: ${result.latency.p99} ms`);
  } finally {
    await mock.stop();
    console.log('Mock server closed.');
  }
}

main().catch(console.error);
