export interface BenchmarkConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
  headers?: Record<string, string>;
  body?: string;
  concurrency: number;
  durationSec?: number;
  totalRequests?: number;
  rpsLimit?: number; // 0 or undefined for uncapped
  timeoutMs?: number;
  keepAlive?: boolean;
}

export interface RequestRecord {
  startTime: number;
  durationMs: number;
  statusCode?: number;
  error?: string;
  bytes: number;
}

export interface LatencyMetrics {
  min: number;
  max: number;
  mean: number;
  stddev: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  p99_9: number;
}

export interface HistogramBucket {
  bottomMs: number;
  topMs: number;
  count: number;
  percentage: number;
  bar: string;
}

export interface BenchmarkResult {
  id: string;
  targetUrl: string;
  method: string;
  timestamp: string;
  durationMs: number;
  concurrency: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number; // 0.0 to 100.0
  rps: number;
  throughputBytesPerSec: number;
  totalBytes: number;
  latency: LatencyMetrics;
  histogram: HistogramBucket[];
  statusCodes: Record<string, number>;
  errors: Record<string, number>;
  passedSla?: boolean;
  slaFailures?: string[];
}

export interface SlaCriteria {
  maxP99Ms?: number;
  maxMeanMs?: number;
  minRps?: number;
  maxErrorRatePct?: number;
}

export interface RunComparison {
  baselineId: string;
  targetId: string;
  rpsChangePct: number;
  p50ChangePct: number;
  p95ChangePct: number;
  p99ChangePct: number;
  errorRateChangePct: number;
  verdict: 'IMPROVED' | 'REGRESSED' | 'NEUTRAL';
  summary: string;
}
