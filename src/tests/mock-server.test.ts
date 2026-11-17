import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { URL } from 'node:url';
import { MockHttpServer } from '../core/mock-server.js';
import { createVirtualTransport } from './test-utils.js';

describe('MockHttpServer Harness', () => {
  it('should handle HTTP requests and return 200 OK responses with metadata', async () => {
    const mock = new MockHttpServer({ port: 9123, minDelayMs: 1, maxDelayMs: 3 });
    const transport = createVirtualTransport((req, res) => mock.handle(req, res));

    const resData = await new Promise<any>((resolve, reject) => {
      const clientReq = transport(new URL('http://127.0.0.1:9123/api/test'), {}, (res: any) => {
        let data = '';
        res.on('data', (c: any) => (data += c));
        res.on('end', () => resolve(JSON.parse(data)));
      });
      clientReq.on('error', reject);
      clientReq.end();
    });

    assert.strictEqual(resData.status, 'ok');
    assert.strictEqual(resData.service, 'benchpulse-mock-target');
    assert.strictEqual(mock.getRequestCount(), 1);
  });

  it('should simulate failure status when error rate is 100%', async () => {
    const mock = new MockHttpServer({ port: 9124, minDelayMs: 1, maxDelayMs: 2, errorRatePct: 100 });
    const transport = createVirtualTransport((req, res) => mock.handle(req, res));

    const statusCode = await new Promise<number>((resolve, reject) => {
      const clientReq = transport(new URL('http://127.0.0.1:9124/api/fail'), {}, (res: any) => {
        resolve(res.statusCode || 0);
      });
      clientReq.on('error', reject);
      clientReq.end();
    });

    assert.strictEqual(statusCode, 500);
    assert.strictEqual(mock.getRequestCount(), 1);
  });
});
