# Concurrency Tuning & Load Architecture

## Overview

BenchPulse implements an asynchronous virtual worker pool running on top of Node's native event loop. To avoid testing distortions (such as TCP socket exhaustion, local port starvation, and coordinated omission), BenchPulse uses specific engineering defaults.

---

## 1. HTTP/HTTPS Keep-Alive Agents

By default, every HTTP benchmark uses an internal `http.Agent` or `https.Agent` configured with:
```typescript
{
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: Math.max(50, concurrency * 2),
  maxFreeSockets: Math.max(50, concurrency * 2)
}
```

### Why Keep-Alive Is Essential:
Without keep-alive, each HTTP request requires:
1. TCP 3-way handshake (`SYN`, `SYN-ACK`, `ACK`) $\approx 1$ RTT.
2. TLS handshake (for HTTPS) $\approx 1\text{–}2$ RTTs.
3. Socket teardown and OS socket transition into `TIME_WAIT`.

Under high request volumes, un-reused sockets quickly exhaust the ephemeral port range (65,535 ports), throwing `EADDRINUSE` or false connection latency spikes. Keep-alive connection pooling ensures that BenchPulse measures the **actual processing time of the server application**, not local socket negotiation.

---

## 2. Choosing the Right Concurrency

- **Lightweight Microservices (1-10 workers):** Ideal for baseline latency profiling and debugging single endpoints.
- **Medium Load (10-50 workers):** Simulates standard multi-user traffic. Suitable for catching thread contention and database connection pool saturation.
- **Heavy Load (50-250 workers):** Simulates peak traffic bursts. Identifies queue saturation and CPU bottlenecks.

---

## 3. Rate-Limiting (RPS Ceiling) vs Maximum Throughput

BenchPulse supports two modes of execution:

1. **Uncapped Mode (`--rps 0`):**
   Workers fire requests continuously as fast as the target server responds. This determines the maximum saturation throughput of the target.
   
2. **Capped Rate Mode (`--rps <N>`):**
   BenchPulse regulates request pacing using an interval token scheduler. This ensures you can stress-test an API at a predetermined steady-state RPS (e.g., 200 req/s) without overwhelming it immediately.

---
*Authored by Jatin Sharma ([https://jatinsh.netlify.app/](https://jatinsh.netlify.app/))*
