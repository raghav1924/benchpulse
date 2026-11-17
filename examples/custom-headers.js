import { BenchmarkRunner, MockHttpServer } from '../dist/index.js';

async function testWithHeaders() {
  const mock = new MockHttpServer({ port: 9992, minDelayMs: 1, maxDelayMs: 4 });
  const mockUrl = await mock.start();

  try {
    const runner = new BenchmarkRunner({
      url: mockUrl,
      concurrency: 8,
      durationSec: 2,
      headers: {
        'Authorization': 'Bearer test-token-12345',
        'X-Tenant-ID': 'enterprise-alpha',
        'X-Request-Source': 'benchpulse-sdk',
      },
    });

    console.log('Sending requests with multi-tenant custom headers...');
    const res = await runner.run();
    console.log(`Executed ${res.totalRequests} requests with custom authentication headers.`);
  } finally {
    await mock.stop();
  }
}

testWithHeaders().catch(console.error);
