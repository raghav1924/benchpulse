import { BenchmarkRunner, MockHttpServer } from '../dist/index.js';

async function main() {
  const mock = new MockHttpServer({ port: 9989, minDelayMs: 2, maxDelayMs: 10 });
  const mockUrl = await mock.start();

  try {
    const runner = new BenchmarkRunner(
      {
        url: mockUrl,
        concurrency: 20,
        durationSec: 4,
      },
      {
        maxP99Ms: 30, // Strict tail latency SLA
        minRps: 200,   // Minimum throughput
        maxErrorRatePct: 0.1,
      }
    );

    console.log('Validating SLA thresholds against service...');
    const result = await runner.run();

    if (result.passedSla) {
      console.log('✔ SLA VERIFICATION PASSED');
    } else {
      console.error('✖ SLA VERIFICATION FAILED:');
      result.slaFailures?.forEach((f) => console.error(`  - ${f}`));
      process.exit(1);
    }
  } finally {
    await mock.stop();
  }
}

main().catch(console.error);
