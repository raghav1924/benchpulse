# BenchPulse CLI Cheatsheet

Quick reference for common BenchPulse commands and options.

---

## ⚡ Essential Commands

| Command | Description |
| :--- | :--- |
| `benchpulse run <url>` | Run benchmark against target URL |
| `benchpulse studio` | Launch embedded Bento Grid Studio on port 6363 |
| `benchpulse mock` | Launch local mock target on port 8899 |
| `benchpulse compare <A> <B>` | Compare two benchmark JSON result files |
| `benchpulse help` | Show help manual |

---

## 🛠️ CLI Flags & Parameters

| Flag | Short | Default | Description |
| :--- | :--- | :--- | :--- |
| `--concurrency` | `-c` | `10` | Virtual concurrent worker threads |
| `--duration` | `-d` | `10` | Run duration in seconds |
| `--requests` | `-n` | - | Max total requests to execute |
| `--method` | `-m` | `GET` | HTTP verb (GET, POST, PUT, DELETE) |
| `--rps` | `-r` | `0` | Rate ceiling (0 = uncapped) |
| `--header` | `-H` | - | Custom header e.g. `-H "Authorization: Bearer <t>"` |
| `--body` | - | - | Raw payload body string |
| `--timeout` | - | `10000` | Request timeout in milliseconds |
| `--port` | - | `6363` | Studio or mock server port |

---

## 🎯 SLA Assertion Flags

| Flag | Description | Non-Zero Exit Code Condition |
| :--- | :--- | :--- |
| `--max-p99 <ms>` | Maximum p99 latency in ms | Exits 1 if `p99 > threshold` |
| `--max-mean <ms>` | Maximum mean latency in ms | Exits 1 if `mean > threshold` |
| `--min-rps <n>` | Minimum throughput in req/s | Exits 1 if `rps < threshold` |
| `--max-error-rate <pct>` | Maximum error percentage | Exits 1 if `errorRate > threshold` |

---

## 📄 Output Format Flags

| Flag | Description |
| :--- | :--- |
| `--json` | Output raw JSON result |
| `--markdown` | Output formatted GitHub Markdown report |
| `--csv` | Output CSV metrics table |
| `-o <file>` | Write result directly to file (e.g. `-o report.md`) |

---
*Authored by Jatin Sharma ([https://jatinsh.netlify.app/](https://jatinsh.netlify.app/))*
