# Tail Latency & Percentile Mathematics

## Formal Mathematical Model

Given a sample of sorted response times $X = \{x_1, x_2, \dots, x_N\}$ where $x_1 \le x_2 \le \dots \le x_N$:

### 1. Arithmetic Mean ($\mu$)
$$\mu = \frac{1}{N}\sum_{i=1}^N x_i$$

### 2. Standard Deviation ($\sigma$)
$$\sigma = \sqrt{\frac{1}{N}\sum_{i=1}^N (x_i - \mu)^2}$$

### 3. Percentile Rank via Linear Interpolation
For any target percentile $p \in [0, 100]$:
$$R = \frac{p}{100}(N - 1)$$
$$k = \lfloor R \rfloor, \quad \alpha = R - k$$
$$P(p) = x_k + \alpha (x_{k+1} - x_k)$$

This continuous formulation ensures high-precision sub-millisecond tail percentile reporting without discrete rounding artifacts.

---
*Authored by [Jatin Sharma](https://jatinsh.netlify.app/)*
