import { BenchmarkRunner, MockHttpServer } from '../dist/index.js';

async function simulateBurst() {
  const mock = new MockHttpServer({ port: 9991, minDelayMs: 2, maxDelayMs: 8 });
  const mockUrl = await mock.start();

  try {
    console.log('⚡ Step 1: Baseline load (5 workers, 3 seconds)...');
    const baseRunner = new BenchmarkRunner({ url: mockUrl, concurrency: 5, durationSec: 3 });
    const baseResult = await baseRunner.run();
    console.log(`Baseline throughput: ${baseResult.rps} req/s | p99: ${baseResult.latency.p99} ms`);

    console.log('\n⚡ Step 2: Burst surge (50 workers, 3 seconds)...');
    const burstRunner = new BenchmarkRunner({ url: mockUrl, concurrency: 50, durationSec: 3 });
    const burstResult = await burstRunner.run();
    console.log(`Burst throughput: ${burstResult.rps} req/s | p99: ${burstResult.latency.p99} ms`);
  } finally {
    await mock.stop();
  }
}

simulateBurst().catch(console.error);
