# ⚡ BenchPulse

> **Developer-First HTTP Load Tester, Concurrent Benchmark Engine & Tail-Latency Percentile Analyzer with Real-Time Bento Grid Studio.**

[![CI](https://github.com/raghav1924/benchpulse/actions/workflows/ci.yml/badge.svg)](https://github.com/raghav1924/benchpulse/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success)](package.json)
[![Author](https://img.shields.io/badge/author-Jatin%20Sharma-00f0ff)](https://jatinsh.netlify.app/)

---

## 🚀 Overview

Average response time is a vanity metric. Real-world degradation lives in the tails: **p90, p95, p99, and p99.9** latency spikes that degrade user experience and violate production SLAs.

**BenchPulse** is a lightweight, zero-dependency HTTP load generator, high-concurrency benchmark engine, and tail-latency analyzer engineered natively in TypeScript. It brings instant microsecond resolution, adaptive histogram density, regression diff comparisons, and a visual **Bento Grid Web Studio** directly to your local machine.

---

## 🎨 Master Design System Integration

BenchPulse’s embedded Web Studio on port `6363` incorporates core aesthetics from the **29 Master Design Patterns Catalog**:

- **Bento Grid (#12):** Modular, responsive glassmorphic cards partitioning target configuration, real-time telemetry, percentile waterfalls, SVG latency curves, and historical run comparisons.
- **Dark Mode UI (#20):** Deep obsidian palette (`#090a0f`) with high-contrast glowing cyan (`#00f0ff`) and ultraviolet (`#9d4edd`) cyber accents.
- **Cybercore (#24):** Monospace typography, glowing telemetry readouts, terminal aesthetic, and pulsing execution badges.
- **Swiss Design (#3):** Clean asymmetric typographic hierarchies, grid alignments, and high data density.
- **Glassmorphism (#10):** Translucent backdrop-filtered cards with subtle borders (`rgba(255, 255, 255, 0.08)`).
- **Neo-Brutalism (#6):** Bold contrasting badges and status indicators for immediate cognitive recognition.

---

## 🌟 Key Features

- **Zero External Dependencies:** Built 100% on native Node.js runtimes (`node:http`, `node:https`, `node:perf_hooks`, `node:crypto`).
- **Microsecond Precision:** High-resolution timing via `performance.now()` with rank interpolation for `p50`, `p75`, `p90`, `p95`, `p99`, and `p99.9`.
- **High-Concurrency Worker Pooling:** Dispatch hundreds or thousands of concurrent virtual workers with HTTP/HTTPS keep-alive connection pooling.
- **Embedded Bento Grid Studio (Port 6363):** One-command interactive web interface with live SVG distribution charts, real-time gauges, and run comparison.
- **Built-in Mock Target Harness (Port 8899):** Offline delay and error simulation harness for deterministic local testing and CI verification.
- **Run Diff & Regression Comparator:** Automatically compare two test runs (Baseline vs Canary) to detect percentage regressions in p99 and throughput.
- **Automated SLA Thresholds in CI/CD:** Assert against `--max-p99`, `--max-mean`, `--min-rps`, and `--max-error-rate` with automated non-zero exit codes.
- **Multi-Format Reporting:** Export instant performance telemetry to JSON, Markdown, and CSV.

---

## 📦 Installation & Quickstart

### Run with NPX
```bash
npx benchpulse run http://127.0.0.1:8899 -c 20 -d 10
```

### Install Globally
```bash
npm install -g benchpulse
```

### Launch Interactive Bento Grid Web Studio
```bash
benchpulse studio --port 6363
```
Visit `http://localhost:6363` in your browser.

---

## 💻 CLI Usage & Commands

```
USAGE:
  benchpulse run <url> [options]       Run concurrent HTTP benchmark against target URL
  benchpulse studio [--port 6363]      Launch embedded Bento Grid Web Studio
  benchpulse mock [--port 8899]        Launch standalone in-process HTTP mock harness
  benchpulse compare <runA> <runB>     Compare two benchmark JSON result files
  benchpulse help                      Show documentation
```

### Common CLI Examples

#### 1. Quick Load Test (20 workers, 10 seconds)
```bash
benchpulse run https://api.mycloud.com/v1/health -c 20 -d 10
```

#### 2. SLA Assertion in CI/CD Pipeline
```bash
benchpulse run https://api.mycloud.com/v1/checkout \
  -c 50 \
  -d 30 \
  --max-p99 65 \
  --max-error-rate 0.5 \
  --min-rps 500
```
*Exits with code `1` and detailed failure summary if any threshold is violated.*

#### 3. Capped Rate Load Test (Token-Bucket Pacing)
```bash
benchpulse run https://api.mycloud.com/v1/search -c 10 -d 60 --rps 250
```

#### 4. Save Markdown & JSON Reports
```bash
benchpulse run https://api.mycloud.com/v1/users -c 15 -d 5 -o report.md
```

#### 5. Compare Baseline vs Canary Run
```bash
benchpulse run http://localhost:3000/api -c 20 -d 10 --json -o baseline.json
# Deploy new changes...
benchpulse run http://localhost:3000/api -c 20 -d 10 --json -o canary.json
benchpulse compare baseline.json canary.json
```

---

## 📊 Programmatic TypeScript API

BenchPulse is fully modular and importable directly into your Node.js or TypeScript projects:

```typescript
import { BenchmarkRunner, MockHttpServer, compareRuns } from 'benchpulse';

// 1. Initialize runner
const runner = new BenchmarkRunner({
  url: 'http://localhost:3000/api/items',
  method: 'GET',
  concurrency: 25,
  durationSec: 15,
  keepAlive: true,
}, {
  maxP99Ms: 45,
  minRps: 1000,
});

// 2. Execute benchmark
const result = await runner.run((progress) => {
  console.log(`Current RPS: ${progress.currentRps} | Completed: ${progress.completedRequests}`);
});

console.log(`p50 Latency: ${result.latency.p50} ms`);
console.log(`p99 Latency: ${result.latency.p99} ms`);
console.log(`Passed SLA: ${result.passedSla}`);
```

---

## 📁 Repository Structure

```
benchpulse/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md        # Structured bug report schema
│   │   └── feature_request.md   # Feature request schema
│   ├── PULL_REQUEST_TEMPLATE.md # Contribution checklist
│   └── workflows/
│       └── ci.yml               # Automated CI test workflow
├── docs/
│   ├── ARCHITECTURE.md          # Subsystem design & component diagrams
│   ├── API_REFERENCE.md         # Programmatic TypeScript SDK reference
│   ├── BENCHMARKS.md            # Empirical performance telemetry
│   ├── CHEATSHEET.md            # CLI parameter cheatsheet
│   ├── CONCURRENCY_TUNING.md    # Worker pool tuning & socket reuse
│   ├── DESIGN_SYSTEM.md         # Bento Grid (#12) & Cybercore (#24) specifications
│   ├── FAQ.md                   # Frequently asked developer questions
│   ├── LOAD_TESTING_ANTI_PATTERNS.md # Coordinated omission & port starvation guide
│   ├── PERCENTILE_MATHEMATICS.md# Formal LaTeX percentile formulas
│   ├── PERCENTILES_AND_HISTOGRAMS.md # Tail latency math & histogram bucketing
│   ├── ROADMAP.md               # Product milestones (Q1/Q2 2027)
│   ├── STUDIO_MANUAL.md         # Web Studio (Port 6363) user guide
│   └── TROUBLESHOOTING.md       # Diagnostic fixes for common errors
├── examples/
│   ├── advanced-recipe.js       # Advanced programmatic SDK workflow
│   ├── basic-benchmark.js       # Basic load test demo
│   ├── burst-traffic.js         # Multi-stage burst surge testing
│   ├── custom-headers.js        # Multi-tenant header injection
│   └── sla-assertion.js         # CI/CD SLA quality gate verification
├── scripts/
│   └── healthcheck.js           # Self-contained runtime healthcheck
├── src/
│   ├── core/
│   │   ├── types.ts             # Benchmark configs, telemetry, & metrics schemas
│   │   ├── stats.ts             # Percentile math, histogram, & SLA engines
│   │   ├── runner.ts            # High-concurrency worker pool & keep-alive dispatcher
│   │   ├── mock-server.ts       # Zero-dependency HTTP delay & fault harness
│   │   └── comparator.ts        # Performance regression & diff comparator
│   ├── server/
│   │   └── studio.ts            # Embedded Bento Grid Web Studio (Port 6363)
│   ├── utils/
│   │   └── logger.ts            # ASCII tables, terminal colors, Markdown/CSV formatters
│   ├── tests/                   # Native Node.js test suites
│   ├── cli.ts                   # CLI arguments parser and dispatchers
│   ├── index.ts                 # Public module exports
│   └── bin.ts                   # Executable shebang wrapper
├── CHANGELOG.md                 # Semantic version release notes
├── CONTRIBUTING.md              # Contributor workflow & guidelines
├── SECURITY.md                  # Vulnerability disclosure policy
├── PRODUCT_BRIEF.md             # Architecture & specification document
├── package.json                 # Zero-dependency package manifest
├── tsconfig.json                # TypeScript ES2022 compiler configuration
├── LICENSE                      # MIT License
└── README.md                    # Comprehensive documentation
```

---

## 🧪 Testing

BenchPulse uses the native Node.js test runner (`node:test`) with zero external test frameworks:

```bash
npm test
```

All tests execute in under 100ms with deterministic coverage across percentiles, worker pools, mock server simulations, diff comparators, and studio endpoints.

---

## 👤 Author & Lab Attribution

- **Architect & Developer:** Jatin Sharma
- **Portfolio:** [https://jatinsh.netlify.app/](https://jatinsh.netlify.app/)
- **GitHub:** [@raghav1924](https://github.com/raghav1924)
- **Email:** [raghavjatin245@gmail.com](mailto:raghavjatin245@gmail.com)
- **Lab Build:** #12 (2026-11-17)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
