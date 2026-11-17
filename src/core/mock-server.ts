import * as http from 'node:http';

export interface MockServerOptions {
  port?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  errorRatePct?: number; // 0 to 100
}

export class MockHttpServer {
  private server: http.Server | null = null;
  private port: number;
  private minDelayMs: number;
  private maxDelayMs: number;
  private errorRatePct: number;
  private requestCount = 0;

  constructor(options: MockServerOptions = {}) {
    this.port = options.port ?? 8899;
    this.minDelayMs = options.minDelayMs ?? 2;
    this.maxDelayMs = options.maxDelayMs ?? 10;
    this.errorRatePct = options.errorRatePct ?? 0;
  }

  public handle(req: any, res: any): void {
    this.requestCount++;
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });

    req.on('end', () => {
      const delay = Math.floor(Math.random() * (this.maxDelayMs - this.minDelayMs + 1)) + this.minDelayMs;
      
      setTimeout(() => {
        const shouldFail = this.errorRatePct > 0 && (Math.random() * 100) < this.errorRatePct;
        
        if (shouldFail) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'error',
            code: 500,
            message: 'Synthetic mock failure',
            timestamp: Date.now()
          }));
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Powered-By': 'BenchPulse-MockHarness',
          'Connection': 'keep-alive'
        });

        res.end(JSON.stringify({
          status: 'ok',
          service: 'benchpulse-mock-target',
          requestNum: this.requestCount,
          url: req.url,
          method: req.method,
          delaySimulatedMs: delay,
          receivedBytes: body.length
        }));
      }, delay);
    });
  }

  public async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
        this.handle(req, res);
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        resolve(`http://127.0.0.1:${this.port}`);
      });
    });
  }

  public async stop(): Promise<void> {
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

  public getPort(): number {
    return this.port;
  }

  public getRequestCount(): number {
    return this.requestCount;
  }
}
