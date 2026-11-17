import * as http from 'node:http';
import * as https from 'node:https';
import { URL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { BenchmarkConfig, BenchmarkResult, RequestRecord, SlaCriteria } from './types.js';
import { computeLatencyMetrics, buildHistogram, evaluateSla } from './stats.js';

export interface ProgressCallback {
  (current: {
    elapsedMs: number;
    completedRequests: number;
    currentRps: number;
    activeConcurrency: number;
    errors: number;
  }): void;
}

export type HttpTransport = (url: URL, options: any, callback?: (res: any) => void) => any;

export class BenchmarkRunner {
  private config: BenchmarkConfig;
  private slaCriteria?: SlaCriteria;
  private customTransport?: HttpTransport;
  private httpAgent?: http.Agent;
  private httpsAgent?: https.Agent;
  private records: RequestRecord[] = [];
  private isRunning = false;
  private shouldStop = false;

  constructor(config: BenchmarkConfig, slaCriteria?: SlaCriteria, customTransport?: HttpTransport) {
    this.config = {
      method: 'GET',
      headers: {
        'User-Agent': 'BenchPulse/1.0.0 (Node.js Benchmark Engine)',
        'Accept': '*/*',
        ...(config.headers || {}),
      },
      durationSec: 10,
      timeoutMs: 10000,
      keepAlive: true,
      ...config,
      concurrency: config.concurrency ?? 10,
    };
    this.slaCriteria = slaCriteria;
    this.customTransport = customTransport;
  }

  public stop(): void {
    this.shouldStop = true;
  }

  public async run(onProgress?: ProgressCallback): Promise<BenchmarkResult> {
    if (this.isRunning) {
      throw new Error('Benchmark runner is already active');
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.records = [];

    const parsedUrl = new URL(this.config.url);
    const isHttps = parsedUrl.protocol === 'https:';

    const maxSockets = Math.max(50, this.config.concurrency * 2);
    if (isHttps) {
      this.httpsAgent = new https.Agent({
        keepAlive: this.config.keepAlive ?? true,
        maxSockets,
        maxFreeSockets: maxSockets,
      });
    } else {
      this.httpAgent = new http.Agent({
        keepAlive: this.config.keepAlive ?? true,
        maxSockets,
        maxFreeSockets: maxSockets,
      });
    }

    const agent = isHttps ? this.httpsAgent : this.httpAgent;
    const startOverall = performance.now();
    const durationMs = (this.config.durationSec ?? 10) * 1000;
    const maxRequests = this.config.totalRequests ?? 0;

    let completed = 0;
    let dispatched = 0;
    let failed = 0;
    let totalBytes = 0;
    const statusCodes: Record<string, number> = {};
    const errors: Record<string, number> = {};

    // Progress ticker
    let progressTimer: NodeJS.Timeout | null = null;
    let lastTickCompleted = 0;
    let lastTickTime = startOverall;

    if (onProgress) {
      progressTimer = setInterval(() => {
        const now = performance.now();
        const deltaSec = (now - lastTickTime) / 1000;
        const currentRps = deltaSec > 0 ? (completed - lastTickCompleted) / deltaSec : 0;
        lastTickCompleted = completed;
        lastTickTime = now;

        onProgress({
          elapsedMs: Math.round(now - startOverall),
          completedRequests: completed,
          currentRps: Math.round(currentRps),
          activeConcurrency: this.config.concurrency,
          errors: failed,
        });
      }, 500);
    }

    const executeSingleRequest = (): Promise<RequestRecord> => {
      return new Promise<RequestRecord>((resolve) => {
        const reqStart = performance.now();
        const client = isHttps ? https : http;

        const headers: Record<string, string | number> = {
          ...(this.config.headers || {}),
        };

        let postPayload: string | undefined = this.config.body;
        if (postPayload && (this.config.method === 'POST' || this.config.method === 'PUT' || this.config.method === 'PATCH')) {
          headers['Content-Length'] = Buffer.byteLength(postPayload);
        }

        const makeRequest = this.customTransport ?? (isHttps ? https.request : http.request);
        const req = makeRequest(
          parsedUrl,
          {
            method: this.config.method || 'GET',
            agent,
            headers,
            timeout: this.config.timeoutMs || 10000,
          },
          (res: http.IncomingMessage) => {
            let bytesReceived = 0;
            res.on('data', (chunk: any) => {
              bytesReceived += (chunk && chunk.length) ? chunk.length : 0;
            });

            res.on('end', () => {
              const reqDuration = performance.now() - reqStart;
              const codeStr = String(res.statusCode || 200);
              statusCodes[codeStr] = (statusCodes[codeStr] || 0) + 1;
              totalBytes += bytesReceived;
              completed++;

              const record: RequestRecord = {
                startTime: reqStart,
                durationMs: reqDuration,
                statusCode: res.statusCode,
                bytes: bytesReceived,
              };
              resolve(record);
            });

            res.on('error', (err: any) => {
              const reqDuration = performance.now() - reqStart;
              const errName = err.code || err.message || 'StreamError';
              errors[errName] = (errors[errName] || 0) + 1;
              failed++;
              completed++;

              resolve({
                startTime: reqStart,
                durationMs: reqDuration,
                error: errName,
                bytes: 0,
              });
            });
          }
        );

        req.on('timeout', () => {
          req.destroy(new Error('ETIMEDOUT'));
        });

        req.on('error', (err: any) => {
          const reqDuration = performance.now() - reqStart;
          const errName = err.code || err.message || 'NetworkError';
          errors[errName] = (errors[errName] || 0) + 1;
          failed++;
          completed++;

          resolve({
            startTime: reqStart,
            durationMs: reqDuration,
            error: errName,
            bytes: 0,
          });
        });

        if (postPayload) {
          req.write(postPayload);
        }
        req.end();
      });
    };

    // Worker loop
    const worker = async () => {
      while (!this.shouldStop) {
        const now = performance.now();
        if (this.config.durationSec && (now - startOverall) >= durationMs) {
          break;
        }
        if (maxRequests > 0) {
          if (dispatched >= maxRequests) {
            break;
          }
          dispatched++;
        }

        // RPS throttling if requested
        if (this.config.rpsLimit && this.config.rpsLimit > 0) {
          const elapsedSec = (now - startOverall) / 1000;
          const expectedTotal = elapsedSec * this.config.rpsLimit;
          if (completed > expectedTotal) {
            await new Promise((r) => setTimeout(r, 20));
            continue;
          }
        }

        const rec = await executeSingleRequest();
        this.records.push(rec);
      }
    };

    try {
      const workers = Array.from({ length: this.config.concurrency }, () => worker());
      await Promise.all(workers);
    } finally {
      if (progressTimer) {
        clearInterval(progressTimer);
      }
      if (this.httpAgent) {
        this.httpAgent.destroy();
      }
      if (this.httpsAgent) {
        this.httpsAgent.destroy();
      }
      this.isRunning = false;
    }

    const totalElapsedMs = performance.now() - startOverall;
    const totalElapsedSec = totalElapsedMs / 1000;
    const rps = totalElapsedSec > 0 ? Number((completed / totalElapsedSec).toFixed(2)) : 0;
    const throughputBytes = totalElapsedSec > 0 ? Number((totalBytes / totalElapsedSec).toFixed(2)) : 0;
    const successfulRequests = completed - failed;
    const errorRate = completed > 0 ? Number(((failed / completed) * 100).toFixed(2)) : 0;

    const latencies = this.records.map((r) => r.durationMs);
    const latencyMetrics = computeLatencyMetrics(latencies);
    const histogram = buildHistogram(latencies, 10);
    const slaResult = evaluateSla(latencyMetrics, rps, errorRate, this.slaCriteria);

    const result: BenchmarkResult = {
      id: `bp-${randomUUID().slice(0, 8)}`,
      targetUrl: this.config.url,
      method: this.config.method || 'GET',
      timestamp: new Date().toISOString(),
      durationMs: Number(totalElapsedMs.toFixed(2)),
      concurrency: this.config.concurrency,
      totalRequests: completed,
      successfulRequests,
      failedRequests: failed,
      errorRate,
      rps,
      throughputBytesPerSec: throughputBytes,
      totalBytes,
      latency: latencyMetrics,
      histogram,
      statusCodes,
      errors,
      passedSla: slaResult.passed,
      slaFailures: slaResult.failures,
    };

    return result;
  }
}
