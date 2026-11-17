import { BenchmarkResult, RunComparison } from './types.js';

export function compareRuns(baseline: BenchmarkResult, target: BenchmarkResult): RunComparison {
  const rpsChangePct = baseline.rps > 0 
    ? Number((((target.rps - baseline.rps) / baseline.rps) * 100).toFixed(2))
    : 0;

  const p50ChangePct = baseline.latency.p50 > 0
    ? Number((((target.latency.p50 - baseline.latency.p50) / baseline.latency.p50) * 100).toFixed(2))
    : 0;

  const p95ChangePct = baseline.latency.p95 > 0
    ? Number((((target.latency.p95 - baseline.latency.p95) / baseline.latency.p95) * 100).toFixed(2))
    : 0;

  const p99ChangePct = baseline.latency.p99 > 0
    ? Number((((target.latency.p99 - baseline.latency.p99) / baseline.latency.p99) * 100).toFixed(2))
    : 0;

  const errorRateChangePct = Number((target.errorRate - baseline.errorRate).toFixed(2));

  let verdict: 'IMPROVED' | 'REGRESSED' | 'NEUTRAL' = 'NEUTRAL';
  let summary = '';

  // Regression if p99 increased by > 10% or error rate increased by > 1% or RPS decreased by > 10%
  if (p99ChangePct > 10 || errorRateChangePct > 1.0 || rpsChangePct < -10) {
    verdict = 'REGRESSED';
    summary = `Performance regression detected: p99 shifted ${p99ChangePct > 0 ? '+' : ''}${p99ChangePct}%, RPS shifted ${rpsChangePct > 0 ? '+' : ''}${rpsChangePct}%, Error diff ${errorRateChangePct > 0 ? '+' : ''}${errorRateChangePct}%`;
  } else if (p99ChangePct < -5 || rpsChangePct > 10) {
    verdict = 'IMPROVED';
    summary = `Performance improved: p99 shifted ${p99ChangePct}%, RPS shifted +${rpsChangePct}%`;
  } else {
    verdict = 'NEUTRAL';
    summary = `Performance within neutral variance bounds (±10% p99 / RPS)`;
  }

  return {
    baselineId: baseline.id,
    targetId: target.id,
    rpsChangePct,
    p50ChangePct,
    p95ChangePct,
    p99ChangePct,
    errorRateChangePct,
    verdict,
    summary,
  };
}
