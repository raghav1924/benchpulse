import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { URL } from 'node:url';
import { StudioServer } from '../server/studio.js';
import { createVirtualTransport } from './test-utils.js';

describe('StudioServer Endpoints', () => {
  it('should serve the Bento Grid HTML dashboard and mock endpoints', async () => {
    const studio = new StudioServer({ port: 6364 });
    const transport = createVirtualTransport((req, res) => {
      studio.handleRequest(req, res);
    });

    // Test GET /
    const html = await new Promise<string>((resolve, reject) => {
      const clientReq = transport(new URL('http://127.0.0.1:6364/'), {}, (res: any) => {
        assert.strictEqual(res.statusCode, 200);
        assert.ok(String(res.headers['content-type']).includes('text/html'));
        let body = '';
        res.on('data', (c: any) => (body += c));
        res.on('end', () => resolve(body));
      });
      clientReq.on('error', reject);
      clientReq.end();
    });

    assert.ok(html.includes('BenchPulse'));
    assert.ok(html.includes('bento-grid'));

    // Test GET /api/mock/status
    const mockStatus = await new Promise<any>((resolve, reject) => {
      const clientReq = transport(new URL('http://127.0.0.1:6364/api/mock/status'), {}, (res: any) => {
        let body = '';
        res.on('data', (c: any) => (body += c));
        res.on('end', () => resolve(JSON.parse(body)));
      });
      clientReq.on('error', reject);
      clientReq.end();
    });
    assert.strictEqual(mockStatus.status, 'stopped');

    // Test GET /api/history
    const historyRes = await new Promise<any>((resolve, reject) => {
      const clientReq = transport(new URL('http://127.0.0.1:6364/api/history'), {}, (res: any) => {
        let body = '';
        res.on('data', (c: any) => (body += c));
        res.on('end', () => resolve(JSON.parse(body)));
      });
      clientReq.on('error', reject);
      clientReq.end();
    });
    assert.ok(Array.isArray(historyRes.history));
  });
});
