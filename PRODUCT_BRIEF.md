# BenchPulse - Product Brief & Specification

**Date:** 2026-11-17  
**Build:** #12  
**Author:** Jatin Sharma (<raghavjatin245@gmail.com>)  
**Portfolio:** [https://jatinsh.netlify.app/](https://jatinsh.netlify.app/)  
**Repository:** [https://github.com/raghav1924/benchpulse](https://github.com/raghav1924/benchpulse)

---

## 1. Executive Summary & Problem Space

Modern cloud applications, edge runtimes, and microservices live or die by tail latency. While simple metrics like average response time or total requests per second give a surface-level impression of health, real-world user degradation happens in the tails: p90, p95, p99, and p99.9 latency spikes.

Existing CLI benchmark tools (such as ApacheBench, wrk, or hey) either:
1. Lack visual tail-latency inspection without piping output to gnuplot or external SaaS.
2. Require heavy external runtime dependencies, Python scripts, or bulky binaries.
3. Obscure latency distributions into coarse buckets without fine-grained percentile percentiles.
4. Fail to provide an instant, interactive local GUI with real-time telemetry and comparison capabilities.

**BenchPulse** solves this as a developer-first, zero-dependency HTTP load tester, concurrent benchmark engine, and real-time Bento Grid Web Studio built natively in TypeScript.

---

## 2. Core Capabilities

1. **High-Performance Concurrent Runner:**
   - Asynchronous worker pool dispatcher with configurable concurrency (1 to 10,000 workers).
   - Dynamic RPS throttling using token-bucket interval pacing.
   - HTTP/HTTPS keep-alive connection pooling with socket reuse.
   - Timeout and connection lifecycle tracking with precise microsecond timing via `node:perf_hooks`.

2. **Microsecond Percentile & Statistical Analysis:**
   - Exact rank and linear interpolation for percentiles: `p50`, `p75`, `p90`, `p95`, `p99`, `p99.9`.
   - Complete metric suite: Min, Max, Mean, Standard Deviation, Requests/sec, Bytes/sec, Throughput (MB/s).
   - Frequency histogram generation with adaptive bucketing and ASCII CLI charts.
   - Status code distribution and detailed error taxonomy (ECONNREFUSED, ETIMEDOUT, ENOTFOUND, ESOCKETTIMEDOUT).

3. **Embedded Bento Grid Studio (Port 6363):**
   - Zero-dependency web interface styled with Bento Grid (#12), Dark Mode (#20), Cybercore (#24), and Swiss (#3) design patterns.
   - Interactive SVG latency distribution curves and percentile waterfall gauges.
   - Live real-time runner with parameter controls (URL, method, headers, concurrency, duration, RPS limit).
   - Side-by-side run comparison engine (Baseline vs Canary latency diffs).
   - Export benchmark reports to JSON, Markdown, and CSV.

4. **Built-in Mock HTTP Test Harness:**
   - In-process HTTP delay and fault simulator for deterministic testing, CI validation, and offline experimentation.

5. **CI/CD Threshold Assertions:**
   - CLI flags for automated SLA regression testing: `--max-p99=<ms>`, `--max-error-rate=<pct>`, `--min-rps=<val>`.
   - Non-zero exit code on SLA breach for seamless GitHub Actions / pipeline integration.
