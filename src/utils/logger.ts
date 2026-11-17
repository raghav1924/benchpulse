import { BenchmarkResult, RunComparison } from '../core/types.js';

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  brightWhite: '\x1b[97m',
};

export function printBanner(): void {
  const banner = `
${colors.cyan}  ╔══════════════════════════════════════════════════════════════════╗
  ║   ${colors.bold}${colors.brightWhite}⚡ BENCHPULSE${colors.reset}${colors.cyan} v1.0.0 — Modern Latency & Load Engine            ║
  ║   Tail Percentiles (p50/p90/p95/p99) • Bento Grid Studio • Node   ║
  ║   Author: Jatin Sharma (https://jatinsh.netlify.app/)            ║
  ╚══════════════════════════════════════════════════════════════════╝${colors.reset}
`;
  process.stdout.write(banner + '\n');
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function printResultTable(res: BenchmarkResult): void {
  const divider = `${colors.gray}──────────────────────────────────────────────────────────────────${colors.reset}`;
  
  process.stdout.write(`\n${colors.bold}${colors.brightWhite}▶ BENCHMARK EXECUTION SUMMARY${colors.reset}\n`);
  process.stdout.write(`${divider}\n`);
  process.stdout.write(`  ${colors.dim}Target URL:${colors.reset}       ${colors.cyan}${res.method} ${res.targetUrl}${colors.reset}\n`);
  process.stdout.write(`  ${colors.dim}Run Duration:${colors.reset}     ${(res.durationMs / 1000).toFixed(2)}s  |  Concurrency: ${colors.bold}${res.concurrency}${colors.reset}\n`);
  process.stdout.write(`  ${colors.dim}Total Requests:${colors.reset}   ${colors.bold}${res.totalRequests.toLocaleString()}${colors.reset}  (Success: ${colors.green}${res.successfulRequests}${colors.reset}, Failed: ${res.failedRequests > 0 ? colors.red : colors.gray}${res.failedRequests}${colors.reset})\n`);
  process.stdout.write(`  ${colors.dim}Throughput:${colors.reset}       ${colors.bold}${colors.green}${res.rps.toLocaleString()} req/s${colors.reset}  |  ${formatBytes(res.throughputBytesPerSec)}/s\n`);
  process.stdout.write(`  ${colors.dim}Data Transfer:${colors.reset}    ${formatBytes(res.totalBytes)}\n`);
  process.stdout.write(`${divider}\n`);

  process.stdout.write(`\n${colors.bold}${colors.brightWhite}▶ LATENCY DISTRIBUTION (MICROSECOND RESOLUTION)${colors.reset}\n`);
  process.stdout.write(`${divider}\n`);
  process.stdout.write(`  ${colors.cyan}Min / Mean / Max:${colors.reset}  ${res.latency.min}ms  /  ${res.latency.mean}ms  /  ${res.latency.max}ms  (σ = ${res.latency.stddev}ms)\n`);
  process.stdout.write(`  ${colors.yellow}p50 (Median):${colors.reset}      ${colors.bold}${res.latency.p50} ms${colors.reset}\n`);
  process.stdout.write(`  ${colors.yellow}p75:${colors.reset}               ${res.latency.p75} ms\n`);
  process.stdout.write(`  ${colors.magenta}p90:${colors.reset}               ${res.latency.p90} ms\n`);
  process.stdout.write(`  ${colors.magenta}p95:${colors.reset}               ${colors.bold}${res.latency.p95} ms${colors.reset}\n`);
  process.stdout.write(`  ${colors.red}p99 (Tail):${colors.reset}        ${colors.bold}${res.latency.p99} ms${colors.reset}\n`);
  process.stdout.write(`  ${colors.red}p99.9 (Extreme):${colors.reset}   ${res.latency.p99_9} ms\n`);
  process.stdout.write(`${divider}\n`);

  if (res.histogram.length > 0) {
    process.stdout.write(`\n${colors.bold}${colors.brightWhite}▶ LATENCY HISTOGRAM${colors.reset}\n`);
    for (const b of res.histogram) {
      const range = `${b.bottomMs.toFixed(1)}ms - ${b.topMs.toFixed(1)}ms`.padEnd(20);
      const pct = `${b.percentage.toFixed(1)}%`.padStart(6);
      const count = `(${b.count.toLocaleString()})`.padStart(9);
      process.stdout.write(`  ${colors.dim}${range}${colors.reset} [${colors.cyan}${b.bar}${colors.reset}] ${pct} ${colors.gray}${count}${colors.reset}\n`);
    }
    process.stdout.write(`${divider}\n`);
  }

  // Status Codes
  const codeEntries = Object.entries(res.statusCodes);
  if (codeEntries.length > 0) {
    process.stdout.write(`  ${colors.dim}Status Codes:${colors.reset}     `);
    const formatted = codeEntries.map(([code, cnt]) => {
      const color = code.startsWith('2') ? colors.green : code.startsWith('3') ? colors.cyan : colors.red;
      return `${color}${code}${colors.reset}: ${cnt}`;
    }).join('   ');
    process.stdout.write(`${formatted}\n`);
  }

  // SLA Evaluation
  if (res.passedSla !== undefined) {
    process.stdout.write(`${divider}\n`);
    if (res.passedSla) {
      process.stdout.write(`  ${colors.green}${colors.bold}✔ SLA ASSERTION: PASSED${colors.reset} All performance thresholds met.\n`);
    } else {
      process.stdout.write(`  ${colors.red}${colors.bold}✘ SLA ASSERTION: FAILED${colors.reset}\n`);
      for (const fail of res.slaFailures || []) {
        process.stdout.write(`    ${colors.red}• ${fail}${colors.reset}\n`);
      }
    }
  }

  process.stdout.write(`${divider}\n\n`);
}

export function printComparison(diff: RunComparison): void {
  const divider = `${colors.gray}──────────────────────────────────────────────────────────────────${colors.reset}`;
  const verdictColor = diff.verdict === 'IMPROVED' ? colors.green : diff.verdict === 'REGRESSED' ? colors.red : colors.yellow;
  
  process.stdout.write(`\n${colors.bold}${colors.brightWhite}▶ BENCHMARK RUN COMPARISON (Baseline vs Target)${colors.reset}\n`);
  process.stdout.write(`${divider}\n`);
  process.stdout.write(`  ${colors.dim}Verdict:${colors.reset}        ${verdictColor}${colors.bold}${diff.verdict}${colors.reset} (${diff.summary})\n`);
  process.stdout.write(`  ${colors.dim}RPS Change:${colors.reset}     ${diff.rpsChangePct >= 0 ? '+' : ''}${diff.rpsChangePct}%\n`);
  process.stdout.write(`  ${colors.dim}p50 Change:${colors.reset}     ${diff.p50ChangePct >= 0 ? '+' : ''}${diff.p50ChangePct}%\n`);
  process.stdout.write(`  ${colors.dim}p95 Change:${colors.reset}     ${diff.p95ChangePct >= 0 ? '+' : ''}${diff.p95ChangePct}%\n`);
  process.stdout.write(`  ${colors.dim}p99 Change:${colors.reset}     ${diff.p99ChangePct >= 0 ? '+' : ''}${diff.p99ChangePct}%\n`);
  process.stdout.write(`${divider}\n\n`);
}

export function generateMarkdownReport(res: BenchmarkResult): string {
  return `# BenchPulse Performance Report

**Target:** \`${res.method} ${res.targetUrl}\`  
**Date:** ${res.timestamp}  
**Run ID:** \`${res.id}\`  
**Duration:** ${(res.durationMs / 1000).toFixed(2)}s | **Concurrency:** ${res.concurrency}  

---

## Executive Metrics

| Metric | Result | Notes |
| :--- | :--- | :--- |
| **Throughput (RPS)** | **${res.rps.toLocaleString()} req/s** | Sustained load rate |
| **Transfer Rate** | **${formatBytes(res.throughputBytesPerSec)}/s** | Network payload bandwidth |
| **Total Requests** | **${res.totalRequests.toLocaleString()}** | ${res.successfulRequests} OK, ${res.failedRequests} Failed |
| **Error Rate** | **${res.errorRate}%** | Failures / Total |
| **p50 Latency** | **${res.latency.p50} ms** | 50th percentile (median) |
| **p90 Latency** | **${res.latency.p90} ms** | 90th percentile |
| **p95 Latency** | **${res.latency.p95} ms** | 95th percentile |
| **p99 Latency** | **${res.latency.p99} ms** | Tail latency ceiling |
| **p99.9 Latency** | **${res.latency.p99_9} ms** | 99.9th percentile spike |

---

## Latency Histogram

| Bucket Range | Count | Percent |
| :--- | :--- | :--- |
${res.histogram.map((b) => `| ${b.bottomMs}ms - ${b.topMs}ms | ${b.count.toLocaleString()} | ${b.percentage}% |`).join('\n')}

---

*Report generated by [BenchPulse](https://github.com/raghav1924/benchpulse) — Built by [Jatin Sharma](https://jatinsh.netlify.app/)*
`;
}

export function generateCsvExport(res: BenchmarkResult): string {
  const lines: string[] = [
    'metric,value,unit',
    `target_url,${res.targetUrl},string`,
    `method,${res.method},string`,
    `duration_sec,${(res.durationMs / 1000).toFixed(2)},seconds`,
    `concurrency,${res.concurrency},count`,
    `total_requests,${res.totalRequests},count`,
    `successful_requests,${res.successfulRequests},count`,
    `failed_requests,${res.failedRequests},count`,
    `rps,${res.rps},req_per_sec`,
    `throughput_bytes_sec,${res.throughputBytesPerSec},bytes_per_sec`,
    `latency_min_ms,${res.latency.min},ms`,
    `latency_mean_ms,${res.latency.mean},ms`,
    `latency_max_ms,${res.latency.max},ms`,
    `latency_stddev_ms,${res.latency.stddev},ms`,
    `latency_p50_ms,${res.latency.p50},ms`,
    `latency_p75_ms,${res.latency.p75},ms`,
    `latency_p90_ms,${res.latency.p90},ms`,
    `latency_p95_ms,${res.latency.p95},ms`,
    `latency_p99_ms,${res.latency.p99},ms`,
    `latency_p99_9_ms,${res.latency.p99_9},ms`,
  ];
  return lines.join('\n');
}
