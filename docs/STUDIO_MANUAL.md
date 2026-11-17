# BenchPulse Bento Grid Studio User Manual

The BenchPulse Studio is a zero-dependency, real-time web interface running locally on port **6363**.

---

## Launching the Studio

Run in your terminal:
```bash
benchpulse studio
```
Or specify a custom port:
```bash
benchpulse studio --port 7000
```
Then navigate to:
```
http://localhost:6363
```

---

## Studio Bento Grid Features

### 1. Header Toolbar
- **Mock Target Toggle:** One-click toggle that spins up the built-in HTTP mock server on port 8899 directly from the browser without needing another terminal window.
- **Instant Export Buttons:** Export current telemetry to Markdown or CSV with one click.

### 2. Target Configuration Bento Card
- Configurable target URL, HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`).
- Real-time concurrency slider (1 to 500 workers).
- Duration and optional RPS throttle ceiling.
- SLA assertion threshold inputs.

### 3. Real-Time Telemetry & Waterfall Card
- **Throughput Gauge:** Requests per second and transfer bandwidth in KB/s.
- **Latency Gauges:** p50 (Median), Mean, p99 (Tail), p99.9 (Extreme).
- **Waterfall Bars:** Proportional color-coded bars for p50, p75, p90, p95, p99, and p99.9.

### 4. Interactive SVG Latency Distribution Card
- Dynamically generates an SVG density curve with 10 adaptive histogram buckets showing sample count, duration span, and shape of the distribution.

### 5. Response Breakdown Card
- Segmented status code counters (`HTTP 200`, `HTTP 404`, `HTTP 500`) and network error categorization (`ECONNREFUSED`, `ETIMEDOUT`).

### 6. Historical Runs & Side-by-Side Diff Comparator
- In-memory run history table with execution records.
- Select two runs via radio buttons (Base vs Target) and click **Compare Selected** to calculate exact percentage shifts in p50, p99, and throughput, complete with automated **IMPROVED** or **REGRESSED** status verdicts.

---
*Authored by Jatin Sharma ([https://jatinsh.netlify.app/](https://jatinsh.netlify.app/))*
