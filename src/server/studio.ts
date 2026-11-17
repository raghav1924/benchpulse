import * as http from 'node:http';
import { URL } from 'node:url';
import { BenchmarkRunner } from '../core/runner.js';
import { BenchmarkConfig, BenchmarkResult, SlaCriteria } from '../core/types.js';
import { MockHttpServer } from '../core/mock-server.js';
import { compareRuns } from '../core/comparator.js';
import { generateMarkdownReport, generateCsvExport } from '../utils/logger.js';

export interface StudioServerOptions {
  port?: number;
}

export class StudioServer {
  private server: http.Server | null = null;
  private port: number;
  private runHistory: BenchmarkResult[] = [];
  private mockServer: MockHttpServer | null = null;

  constructor(options: StudioServerOptions = {}) {
    this.port = options.port ?? 6363;
  }

  public async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
        this.handleRequest(req, res).catch((err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        resolve(`http://127.0.0.1:${this.port}`);
      });
    });
  }

  public async handleRequest(req: any, res: any): Promise<void> {
    const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);

    // CORS headers for local tooling
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // API routes
    if (url.pathname === '/api/history' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ history: this.runHistory }));
      return;
    }

    if (url.pathname === '/api/mock/toggle' && req.method === 'POST') {
      try {
        if (this.mockServer) {
          await this.mockServer.stop();
          this.mockServer = null;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'stopped', mockUrl: null }));
        } else {
          this.mockServer = new MockHttpServer({ port: 8899, minDelayMs: 2, maxDelayMs: 12 });
          const mockUrl = await this.mockServer.start();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'running', mockUrl }));
        }
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (url.pathname === '/api/mock/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: this.mockServer ? 'running' : 'stopped',
        mockUrl: this.mockServer ? `http://127.0.0.1:${this.mockServer.getPort()}` : null,
      }));
      return;
    }

    if (url.pathname === '/api/compare' && req.method === 'GET') {
      const baseId = url.searchParams.get('base');
      const targetId = url.searchParams.get('target');
      const base = this.runHistory.find((r) => r.id === baseId);
      const target = this.runHistory.find((r) => r.id === targetId);

      if (!base || !target) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Base or target run not found in history' }));
        return;
      }

      const diff = compareRuns(base, target);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(diff));
      return;
    }

    if (url.pathname === '/api/export' && req.method === 'GET') {
      const runId = url.searchParams.get('id');
      const format = url.searchParams.get('format') || 'json';
      const run = this.runHistory.find((r) => r.id === runId) || this.runHistory[0];

      if (!run) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No benchmark runs available to export' }));
        return;
      }

      if (format === 'markdown') {
        res.writeHead(200, {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="benchpulse-${run.id}.md"`,
        });
        res.end(generateMarkdownReport(run));
        return;
      } else if (format === 'csv') {
        res.writeHead(200, {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="benchpulse-${run.id}.csv"`,
        });
        res.end(generateCsvExport(run));
        return;
      } else {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="benchpulse-${run.id}.json"`,
        });
        res.end(JSON.stringify(run, null, 2));
        return;
      }
    }

    if (url.pathname === '/api/run' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: any) => {
        body += chunk;
      });

      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          const config: BenchmarkConfig = {
            url: data.url || 'http://127.0.0.1:8899',
            method: data.method || 'GET',
            concurrency: Number(data.concurrency) || 10,
            durationSec: Number(data.durationSec) || 5,
            rpsLimit: data.rpsLimit ? Number(data.rpsLimit) : undefined,
            headers: data.headers || {},
            body: data.body || undefined,
          };

          const slaCriteria: SlaCriteria | undefined = data.sla ? {
            maxP99Ms: data.sla.maxP99Ms ? Number(data.sla.maxP99Ms) : undefined,
            minRps: data.sla.minRps ? Number(data.sla.minRps) : undefined,
            maxErrorRatePct: data.sla.maxErrorRatePct ? Number(data.sla.maxErrorRatePct) : undefined,
          } : undefined;

          const runner = new BenchmarkRunner(config, slaCriteria);
          const result = await runner.run();
          this.runHistory.unshift(result);
          if (this.runHistory.length > 30) {
            this.runHistory.pop();
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message || 'Benchmark execution failed' }));
        }
      });
      return;
    }

    // Serve Web Studio HTML
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(this.renderStudioHtml());
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  public async stop(): Promise<void> {
    if (this.mockServer) {
      await this.mockServer.stop();
      this.mockServer = null;
    }
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private renderStudioHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BenchPulse Studio — Microsecond Latency & Load Engine</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090a0f;
      --card-bg: rgba(18, 20, 29, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --card-glow: rgba(0, 240, 255, 0.05);
      --accent: #00f0ff;
      --accent-glow: rgba(0, 240, 255, 0.35);
      --accent-purple: #9d4edd;
      --accent-green: #10b981;
      --accent-red: #f43f5e;
      --accent-yellow: #f59e0b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 15% 15%, rgba(0, 240, 255, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 85% 85%, rgba(157, 78, 221, 0.08) 0%, transparent 40%),
        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 32px 32px, 32px 32px;
      color: var(--text);
      font-family: var(--font-sans);
      min-height: 100vh;
      padding: 24px;
    }

    /* Container & Bento Grid */
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      margin-bottom: 24px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo-badge {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #00f0ff 0%, #9d4edd 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 800;
      color: #000;
      box-shadow: 0 0 20px var(--accent-glow);
    }

    .brand-title h1 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .brand-title span.tag {
      font-family: var(--font-mono);
      font-size: 11px;
      padding: 2px 8px;
      background: rgba(0, 240, 255, 0.15);
      color: var(--accent);
      border-radius: 6px;
      border: 1px solid rgba(0, 240, 255, 0.3);
    }

    .brand-title p {
      font-size: 12px;
      color: var(--text-muted);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 10px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: var(--font-sans);
    }

    .btn-primary {
      background: linear-gradient(135deg, #00f0ff 0%, #0284c7 100%);
      color: #050a12;
      box-shadow: 0 4px 16px rgba(0, 240, 255, 0.3);
    }

    .btn-primary:hover {
      box-shadow: 0 6px 24px rgba(0, 240, 255, 0.5);
      transform: translateY(-1px);
    }

    .btn-outline {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      border-color: var(--card-border);
    }

    .btn-outline:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
    }

    /* Bento Grid Layout */
    .bento-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 20px;
    }

    .bento-card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 22px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      transition: border-color 0.3s;
    }

    .bento-card:hover {
      border-color: rgba(0, 240, 255, 0.25);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }

    .card-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-title .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 8px var(--accent);
    }

    /* Column Spans */
    .col-4 { grid-column: span 4; }
    .col-6 { grid-column: span 6; }
    .col-8 { grid-column: span 8; }
    .col-12 { grid-column: span 12; }

    /* Inputs & Forms */
    .form-group {
      margin-bottom: 14px;
    }

    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    input, select, textarea {
      width: 100%;
      background: rgba(10, 12, 18, 0.8);
      border: 1px solid var(--card-border);
      color: var(--text);
      padding: 10px 14px;
      border-radius: 8px;
      font-family: var(--font-mono);
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s;
    }

    input:focus, select:focus, textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    /* Metric Tiles */
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    .metric-box {
      background: rgba(10, 12, 18, 0.6);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 14px;
      position: relative;
    }

    .metric-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-val {
      font-family: var(--font-mono);
      font-size: 22px;
      font-weight: 700;
      color: var(--text);
      margin-top: 4px;
    }

    .metric-sub {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .accent-cyan { color: var(--accent); }
    .accent-green { color: var(--accent-green); }
    .accent-yellow { color: var(--accent-yellow); }
    .accent-red { color: var(--accent-red); }
    .accent-purple { color: var(--accent-purple); }

    /* SVG Histogram Chart */
    .chart-container {
      width: 100%;
      height: 220px;
      margin-top: 10px;
    }

    /* Percentile Waterfall */
    .percentile-waterfall {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 10px;
    }

    .waterfall-row {
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: var(--font-mono);
      font-size: 12px;
    }

    .waterfall-tag {
      width: 60px;
      font-weight: 700;
      color: var(--accent);
    }

    .waterfall-bar-bg {
      flex: 1;
      height: 10px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 5px;
      overflow: hidden;
    }

    .waterfall-bar-fill {
      height: 100%;
      border-radius: 5px;
      background: linear-gradient(90deg, var(--accent) 0%, var(--accent-purple) 100%);
      transition: width 0.4s ease;
    }

    .waterfall-val {
      width: 75px;
      text-align: right;
      font-weight: 600;
    }

    /* Status badges */
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      font-family: var(--font-mono);
    }

    .badge-ok { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-warn { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-err { background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); }

    /* History table */
    .history-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 10px;
    }

    .history-table th {
      text-align: left;
      padding: 10px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--card-border);
      font-weight: 600;
    }

    .history-table td {
      padding: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      font-family: var(--font-mono);
    }

    .history-table tr:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    /* Footer */
    footer {
      margin-top: 32px;
      text-align: center;
      padding: 20px;
      color: var(--text-muted);
      font-size: 12px;
      border-top: 1px solid var(--card-border);
    }

    footer a {
      color: var(--accent);
      text-decoration: none;
    }

    footer a:hover {
      text-decoration: underline;
    }

    /* Loading Pulse */
    .pulsing {
      animation: pulseAnim 1.5s infinite;
    }

    @keyframes pulseAnim {
      0% { opacity: 0.6; }
      50% { opacity: 1; filter: drop-shadow(0 0 12px var(--accent)); }
      100% { opacity: 0.6; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="logo-badge">⚡</div>
        <div class="brand-title">
          <h1>BenchPulse <span class="tag">STUDIO v1.0</span></h1>
          <p>Microsecond Latency Engine & Tail Percentile Bento Observability</p>
        </div>
      </div>
      <div class="header-actions">
        <button id="toggleMockBtn" class="btn btn-outline" onclick="toggleMockServer()">
          <span>Mock Target: Off</span>
        </button>
        <button class="btn btn-outline" onclick="exportData('markdown')">
          <span>Export Markdown</span>
        </button>
        <button class="btn btn-outline" onclick="exportData('csv')">
          <span>Export CSV</span>
        </button>
      </div>
    </header>

    <div class="bento-grid">
      <!-- Card 1: Benchmark Configuration (span 4) -->
      <div class="bento-card col-4">
        <div class="card-header">
          <div class="card-title"><span class="dot"></span>Target Configuration</div>
        </div>
        <form id="benchForm" onsubmit="executeBenchmark(event)">
          <div class="form-group">
            <label>TARGET URL</label>
            <input type="text" id="targetUrl" value="http://127.0.0.1:8899" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>METHOD</label>
              <select id="targetMethod">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div class="form-group">
              <label>CONCURRENCY (WORKERS)</label>
              <input type="number" id="concurrency" value="15" min="1" max="500" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>DURATION (SECONDS)</label>
              <input type="number" id="durationSec" value="5" min="1" max="120" />
            </div>
            <div class="form-group">
              <label>RPS CEILING (0 = UNCAPPED)</label>
              <input type="number" id="rpsLimit" value="0" min="0" />
            </div>
          </div>

          <div class="form-group">
            <label>SLA THRESHOLD (MAX p99 MS, OPTIONAL)</label>
            <input type="number" id="slaP99" placeholder="e.g. 50" />
          </div>

          <button type="submit" id="runBtn" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 8px;">
            <span>⚡ INITIATE BENCHMARK RUN</span>
          </button>
        </form>
      </div>

      <!-- Card 2: Executive Overview Telemetry (span 8) -->
      <div class="bento-card col-8">
        <div class="card-header">
          <div class="card-title"><span class="dot"></span>Live Execution Telemetry</div>
          <span id="runBadge" class="badge badge-ok">READY</span>
        </div>

        <div class="metric-grid">
          <div class="metric-box">
            <div class="metric-label">Throughput (RPS)</div>
            <div class="metric-val accent-cyan" id="metricRps">0</div>
            <div class="metric-sub" id="metricBytesSec">0 KB/s</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Median Latency (p50)</div>
            <div class="metric-val accent-green" id="metricP50">0<span style="font-size:14px">ms</span></div>
            <div class="metric-sub" id="metricMean">Mean: 0ms</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Tail Latency (p99)</div>
            <div class="metric-val accent-red" id="metricP99">0<span style="font-size:14px">ms</span></div>
            <div class="metric-sub" id="metricP999">p99.9: 0ms</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Success Rate</div>
            <div class="metric-val accent-purple" id="metricSuccessRate">100%</div>
            <div class="metric-sub" id="metricTotalReqs">0 requests</div>
          </div>
        </div>

        <div style="margin-top: 24px;">
          <div class="card-title" style="margin-bottom: 12px;"><span class="dot"></span>Percentile Waterfall Distribution</div>
          <div class="percentile-waterfall" id="waterfallContainer">
            <div class="waterfall-row"><span class="waterfall-tag">p50</span><div class="waterfall-bar-bg"><div class="waterfall-bar-fill" style="width: 0%;"></div></div><span class="waterfall-val" id="wfP50">0 ms</span></div>
            <div class="waterfall-row"><span class="waterfall-tag">p75</span><div class="waterfall-bar-bg"><div class="waterfall-bar-fill" style="width: 0%;"></div></div><span class="waterfall-val" id="wfP75">0 ms</span></div>
            <div class="waterfall-row"><span class="waterfall-tag">p90</span><div class="waterfall-bar-bg"><div class="waterfall-bar-fill" style="width: 0%;"></div></div><span class="waterfall-val" id="wfP90">0 ms</span></div>
            <div class="waterfall-row"><span class="waterfall-tag">p95</span><div class="waterfall-bar-bg"><div class="waterfall-bar-fill" style="width: 0%;"></div></div><span class="waterfall-val" id="wfP95">0 ms</span></div>
            <div class="waterfall-row"><span class="waterfall-tag">p99</span><div class="waterfall-bar-bg"><div class="waterfall-bar-fill" style="width: 0%; background: #f43f5e;"></div></div><span class="waterfall-val" id="wfP99">0 ms</span></div>
            <div class="waterfall-row"><span class="waterfall-tag">p99.9</span><div class="waterfall-bar-bg"><div class="waterfall-bar-fill" style="width: 0%; background: #9d4edd;"></div></div><span class="waterfall-val" id="wfP999">0 ms</span></div>
          </div>
        </div>
      </div>

      <!-- Card 3: Interactive SVG Latency Distribution Curve (span 8) -->
      <div class="bento-card col-8">
        <div class="card-header">
          <div class="card-title"><span class="dot"></span>Latency Frequency Histogram (ms)</div>
          <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">Adaptive 10-Bucket Density</span>
        </div>
        <div class="chart-container" id="histogramChart">
          <svg width="100%" height="100%" viewBox="0 0 700 200" preserveAspectRatio="none" id="histSvg">
            <line x1="40" y1="170" x2="680" y2="170" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
            <text x="350" y="100" fill="rgba(255,255,255,0.3)" font-family="monospace" text-anchor="middle" font-size="12">Run a benchmark to render distribution curve</text>
          </svg>
        </div>
      </div>

      <!-- Card 4: Status Code & Health Breakdown (span 4) -->
      <div class="bento-card col-4">
        <div class="card-header">
          <div class="card-title"><span class="dot"></span>Response Breakdown</div>
        </div>
        <div id="statusList" style="display: flex; flex-direction: column; gap: 8px; font-family: var(--font-mono); font-size: 13px;">
          <div style="color: var(--text-muted); font-size: 12px;">No requests recorded yet.</div>
        </div>
      </div>

      <!-- Card 5: Benchmark Run History & Diff Comparator (span 12) -->
      <div class="bento-card col-12">
        <div class="card-header">
          <div class="card-title"><span class="dot"></span>Benchmark History & Regression Comparator</div>
          <button class="btn btn-outline" style="padding: 6px 12px; font-size: 12px;" onclick="compareSelectedRuns()">Compare Selected (Diff)</button>
        </div>
        <div id="diffOutput" style="display:none; margin-bottom: 16px; padding: 12px; border-radius: 8px; background: rgba(0,240,255,0.05); border: 1px solid rgba(0,240,255,0.2); font-family: var(--font-mono); font-size: 13px;"></div>
        <div style="overflow-x: auto;">
          <table class="history-table">
            <thead>
              <tr>
                <th width="40">Base</th>
                <th width="40">Target</th>
                <th>Run ID</th>
                <th>Target</th>
                <th>Concurrency</th>
                <th>Throughput</th>
                <th>p50 Latency</th>
                <th>p99 Latency</th>
                <th>Errors</th>
                <th>SLA</th>
              </tr>
            </thead>
            <tbody id="historyBody">
              <tr><td colspan="10" style="text-align: center; color: var(--text-muted);">No runs in history.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <footer>
      <p>BenchPulse v1.0.0 — Crafted by <a href="https://jatinsh.netlify.app/" target="_blank">Jatin Sharma</a> • <a href="https://github.com/raghav1924/benchpulse" target="_blank">GitHub Repository</a> • Portfolio Lab Build #12</p>
    </footer>
  </div>

  <script>
    let currentRuns = [];
    let isMockRunning = false;

    // Check Mock Server status
    async function checkMockStatus() {
      try {
        const res = await fetch('/api/mock/status');
        const data = await res.json();
        isMockRunning = data.status === 'running';
        const btn = document.getElementById('toggleMockBtn');
        if (isMockRunning) {
          btn.innerHTML = '<span>Mock Target: 8899 (ON)</span>';
          btn.classList.add('btn-primary');
          btn.classList.remove('btn-outline');
        } else {
          btn.innerHTML = '<span>Mock Target: Off</span>';
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-outline');
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function toggleMockServer() {
      try {
        const res = await fetch('/api/mock/toggle', { method: 'POST' });
        const data = await res.json();
        await checkMockStatus();
      } catch (err) {
        alert('Failed to toggle mock target: ' + err.message);
      }
    }

    async function executeBenchmark(e) {
      e.preventDefault();
      const runBtn = document.getElementById('runBtn');
      const runBadge = document.getElementById('runBadge');
      runBtn.disabled = true;
      runBtn.classList.add('pulsing');
      runBadge.className = 'badge badge-warn';
      runBadge.innerText = 'BENCHMARKING...';

      const payload = {
        url: document.getElementById('targetUrl').value,
        method: document.getElementById('targetMethod').value,
        concurrency: parseInt(document.getElementById('concurrency').value, 10),
        durationSec: parseInt(document.getElementById('durationSec').value, 10),
        rpsLimit: parseInt(document.getElementById('rpsLimit').value, 10) || 0,
      };

      const slaVal = document.getElementById('slaP99').value;
      if (slaVal) {
        payload.sla = { maxP99Ms: parseFloat(slaVal) };
      }

      try {
        const res = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (result.error) {
          alert('Error: ' + result.error);
        } else {
          updateUiWithResult(result);
          loadHistory();
        }
      } catch (err) {
        alert('Benchmark request failed: ' + err.message);
      } finally {
        runBtn.disabled = false;
        runBtn.classList.remove('pulsing');
        runBadge.className = 'badge badge-ok';
        runBadge.innerText = 'COMPLETED';
      }
    }

    function updateUiWithResult(res) {
      document.getElementById('metricRps').innerText = res.rps.toLocaleString();
      const kbSec = (res.throughputBytesPerSec / 1024).toFixed(1);
      document.getElementById('metricBytesSec').innerText = kbSec + ' KB/s';
      document.getElementById('metricP50').innerHTML = res.latency.p50 + '<span style="font-size:14px">ms</span>';
      document.getElementById('metricMean').innerText = 'Mean: ' + res.latency.mean + 'ms';
      document.getElementById('metricP99').innerHTML = res.latency.p99 + '<span style="font-size:14px">ms</span>';
      document.getElementById('metricP999').innerText = 'p99.9: ' + res.latency.p99_9 + 'ms';
      
      const successPct = (100 - res.errorRate).toFixed(1);
      document.getElementById('metricSuccessRate').innerText = successPct + '%';
      document.getElementById('metricTotalReqs').innerText = res.totalRequests.toLocaleString() + ' reqs';

      // Waterfall
      const maxLat = Math.max(res.latency.p99_9, 1);
      updateWfRow('wfP50', res.latency.p50, maxLat);
      updateWfRow('wfP75', res.latency.p75, maxLat);
      updateWfRow('wfP90', res.latency.p90, maxLat);
      updateWfRow('wfP95', res.latency.p95, maxLat);
      updateWfRow('wfP99', res.latency.p99, maxLat);
      updateWfRow('wfP999', res.latency.p99_9, maxLat);

      // Render SVG Histogram
      renderSvgHistogram(res.histogram);

      // Render Status codes
      const statusDiv = document.getElementById('statusList');
      statusDiv.innerHTML = '';
      for (const [code, count] of Object.entries(res.statusCodes)) {
        const badgeClass = code.startsWith('2') ? 'badge-ok' : 'badge-err';
        statusDiv.innerHTML += '<div style="display:flex; justify-content:space-between; align-items:center;"><span>HTTP ' + code + '</span><span class="badge ' + badgeClass + '">' + count.toLocaleString() + '</span></div>';
      }
      for (const [errName, count] of Object.entries(res.errors)) {
        statusDiv.innerHTML += '<div style="display:flex; justify-content:space-between; align-items:center;"><span>' + errName + '</span><span class="badge badge-err">' + count.toLocaleString() + '</span></div>';
      }
    }

    function updateWfRow(elementId, val, maxVal) {
      const el = document.getElementById(elementId);
      el.innerText = val + ' ms';
      const fillEl = el.previousElementSibling.firstElementChild;
      const pct = Math.min(100, Math.max(2, (val / maxVal) * 100));
      fillEl.style.width = pct + '%';
    }

    function renderSvgHistogram(buckets) {
      const svg = document.getElementById('histSvg');
      if (!buckets || buckets.length === 0) return;

      const maxCount = Math.max(...buckets.map(b => b.count), 1);
      const width = 640;
      const height = 150;
      const offsetX = 40;
      const offsetY = 20;
      const barWidth = Math.floor(width / buckets.length) - 8;

      let svgContent = '<line x1="40" y1="170" x2="680" y2="170" stroke="rgba(255,255,255,0.1)" stroke-width="1" />';

      buckets.forEach((b, i) => {
        const barHeight = Math.max(4, Math.round((b.count / maxCount) * height));
        const x = offsetX + i * (barWidth + 8);
        const y = 170 - barHeight;

        svgContent += '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="url(#histGrad)" rx="3" opacity="0.85" />';
        svgContent += '<text x="' + (x + barWidth / 2) + '" y="' + (y - 5) + '" fill="#00f0ff" font-family="monospace" text-anchor="middle" font-size="10">' + b.count + '</text>';
        svgContent += '<text x="' + (x + barWidth / 2) + '" y="186" fill="#94a3b8" font-family="monospace" text-anchor="middle" font-size="9">' + b.bottomMs + 'm</text>';
      });

      svgContent += '<defs><linearGradient id="histGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#00f0ff" /><stop offset="100%" stop-color="#9d4edd" /></linearGradient></defs>';
      svg.innerHTML = svgContent;
    }

    async function loadHistory() {
      try {
        const res = await fetch('/api/history');
        const data = await res.json();
        currentRuns = data.history || [];
        const tbody = document.getElementById('historyBody');
        if (currentRuns.length === 0) {
          tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">No runs in history.</td></tr>';
          return;
        }

        tbody.innerHTML = currentRuns.map((r, idx) => {
          const slaTag = r.passedSla === undefined ? '-' : r.passedSla ? '<span class="badge badge-ok">PASS</span>' : '<span class="badge badge-err">FAIL</span>';
          return '<tr>' +
            '<td><input type="radio" name="baseRun" value="' + r.id + '" ' + (idx === 1 ? 'checked' : '') + ' /></td>' +
            '<td><input type="radio" name="targetRun" value="' + r.id + '" ' + (idx === 0 ? 'checked' : '') + ' /></td>' +
            '<td>' + r.id + '</td>' +
            '<td>' + r.method + ' ' + r.targetUrl + '</td>' +
            '<td>' + r.concurrency + '</td>' +
            '<td>' + r.rps.toLocaleString() + ' req/s</td>' +
            '<td>' + r.latency.p50 + ' ms</td>' +
            '<td>' + r.latency.p99 + ' ms</td>' +
            '<td>' + r.failedRequests + '</td>' +
            '<td>' + slaTag + '</td>' +
          '</tr>';
        }).join('');
      } catch (err) {
        console.error(err);
      }
    }

    async function compareSelectedRuns() {
      const baseEl = document.querySelector('input[name="baseRun"]:checked');
      const targetEl = document.querySelector('input[name="targetRun"]:checked');
      if (!baseEl || !targetEl) {
        alert('Please select a base run and a target run.');
        return;
      }
      try {
        const res = await fetch('/api/compare?base=' + baseEl.value + '&target=' + targetEl.value);
        const data = await res.json();
        const diffBox = document.getElementById('diffOutput');
        diffBox.style.display = 'block';
        const verdictColor = data.verdict === 'IMPROVED' ? '#10b981' : data.verdict === 'REGRESSED' ? '#f43f5e' : '#f59e0b';
        diffBox.innerHTML = '<strong>COMPARISON VERDICT:</strong> <span style="color:' + verdictColor + '; font-weight:bold;">' + data.verdict + '</span> — ' + data.summary + '<br/>' +
          'RPS Shift: <strong>' + (data.rpsChangePct >= 0 ? '+' : '') + data.rpsChangePct + '%</strong> | ' +
          'p50 Shift: <strong>' + (data.p50ChangePct >= 0 ? '+' : '') + data.p50ChangePct + '%</strong> | ' +
          'p99 Shift: <strong>' + (data.p99ChangePct >= 0 ? '+' : '') + data.p99ChangePct + '%</strong>';
      } catch (err) {
        alert('Comparison failed: ' + err.message);
      }
    }

    function exportData(format) {
      window.location.href = '/api/export?format=' + format;
    }

    // Init
    checkMockStatus();
    loadHistory();
  </script>
</body>
</html>`;
  }
}
