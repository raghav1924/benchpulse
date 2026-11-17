# Tail Latency, Percentiles & Adaptive Histograms in BenchPulse

## Why Tail Latency Matters More Than Mean

In distributed systems, cloud microservices, and modern web applications, the arithmetic mean (average) latency is fundamentally misleading.

Consider a service where 99 requests take **10ms**, but 1 request takes **5,000ms**:
- **Mean:** $\approx 59.9\text{ms}$ (looks reasonably healthy)
- **p50 (Median):** $10\text{ms}$
- **p99 (Tail):** $10\text{ms}$
- **p99.9 (Extreme Tail):** $5,000\text{ms}$

If a single web page makes 50 downstream API calls to render, the probability of at least one user encountering that 5,000ms tail is:
$$1 - (0.999)^{50} \approx 4.88\%$$
Nearly 1 in 20 users experience a 5-second hang, while dashboard averages show "under 60ms".

---

## Linear Interpolation Percentile Algorithm

BenchPulse calculates percentiles using the standard continuous rank linear interpolation method:

Given an ordered set of latency samples $X = [x_0, x_1, \dots, x_{N-1}]$:

1. **Calculate Rank:**
   $$R = \frac{P}{100} \times (N - 1)$$
2. **Decompose Rank:**
   $$k = \lfloor R \rfloor, \quad d = R - k$$
3. **Interpolate Value:**
   $$v(P) = x_k \cdot (1 - d) + x_{k+1} \cdot d$$

This approach guarantees continuous percentile transitions without sudden discrete quantization jumps on small sample sizes.

---

## Percentiles Tracked in BenchPulse

| Metric | Percentile | Description | Target SLA Focus |
| :--- | :--- | :--- | :--- |
| **p50** | 50th | Median experience | Core responsiveness |
| **p75** | 75th | Upper quartiles | Routine variance |
| **p90** | 90th | Degradation boundary | Edge of acceptable latency |
| **p95** | 95th | Heavy tail | Production alert threshold |
| **p99** | 99th | Outlier boundary | Hard contract SLA limit |
| **p99.9**| 99.9th | Extreme spikes | GC pauses, thread pool starvation |

---

## Adaptive Histogram Generation

BenchPulse computes a 10-bucket density distribution:
1. Determines global minimum $x_{\min}$ and maximum $x_{\max}$.
2. Sets bucket width $\Delta = (x_{\max} - x_{\min}) / 10$.
3. Partitions samples into intervals $[x_{\min} + i\Delta, x_{\min} + (i+1)\Delta)$.
4. Normalizes count into percentage frequencies and renders both high-resolution SVG curves in the Web Studio and ASCII bars in the CLI.

---
*Authored by Jatin Sharma ([https://jatinsh.netlify.app/](https://jatinsh.netlify.app/))*
