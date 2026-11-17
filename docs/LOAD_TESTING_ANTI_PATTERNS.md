# Load Testing Anti-Patterns & Best Practices

Avoid these 4 common load testing traps when evaluating web services:

---

## 1. Coordinated Omission
When a target service stalls under heavy load, client threads that wait synchronously are blocked from issuing new requests. The tester fails to record the requests that would have arrived during the stall, artificially deflating measured latency.

**Mitigation:** BenchPulse uses asynchronous non-blocking event dispatchers to maintain true scheduling intervals.

---

## 2. Ephemeral Port Starvation
Creating new TCP sockets for each request rapidly consumes the client OS's ephemeral port pool (~65k sockets), causing local `EADDRINUSE` errors.

**Mitigation:** BenchPulse enables HTTP/HTTPS keep-alive pooling by default (`keepAlive: true`).

---

## 3. Optimizing for Averages
Dashboard averages hide extreme tail latency spikes ($p_{99}, p_{99.9}$).

**Mitigation:** Always evaluate p90, p95, and p99 percentiles alongside error distributions.

---

## 4. Unrealistic Constant Rate Tests
Real world traffic exhibits diurnal rhythms and burstiness.

**Mitigation:** Combine steady-state baseline load tests with burst-traffic simulations.

---
*Authored by [Jatin Sharma](https://jatinsh.netlify.app/)*
