# BenchPulse Design System Specification

BenchPulse integrates core aesthetics from the **29 Master Design Patterns Catalog**:

---

## 1. Bento Grid (#12)
- **Grid Architecture:** 12-column responsive layout partitioning the interface into modular, self-contained functional cards.
- **Card Hierarchy:**
  - **Column 4:** Target configuration & parameter controls.
  - **Column 8:** Real-time throughput metrics & percentile waterfall.
  - **Column 8:** High-resolution SVG latency density curve.
  - **Column 4:** HTTP status codes & network error taxonomy.
  - **Column 12:** Historical benchmark runs & side-by-side diff comparator.

---

## 2. Dark Mode UI (#20)
- **Base Background:** Obsidian `#090a0f` with dual radial cyan/purple light cones.
- **Card Background:** Translucent `rgba(18, 20, 29, 0.75)` with `backdrop-filter: blur(16px)`.
- **Card Borders:** Subtle frosted glass outlines `rgba(255, 255, 255, 0.08)` that glow on hover.

---

## 3. Cybercore (#24)
- **Palette Accents:**
  - Electric Cyan: `#00f0ff` (Primary actions, active indicators, live throughput)
  - Neon Purple: `#9d4edd` (Upper percentiles, secondary gradients)
  - Cyber Green: `#10b981` (Success rates, healthy latencies, 2xx responses)
  - Crimson Alert: `#f43f5e` (p99 tail latencies, error codes, failed SLAs)
- **Dynamic Elements:** Pulsing execution badges, glowing borders, and live telemetry tickers.

---

## 4. Swiss Design (#3)
- **Typography:** Asymmetric hierarchy pairing **Plus Jakarta Sans** for crisp legible headlines with **JetBrains Mono** for numerical values and technical metrics.
- **Data Density:** High information density without visual clutter, strict horizontal dividers, and structured data tables.

---

## 5. Glassmorphism (#10) & Neo-Brutalism (#6)
- **Glassmorphism:** Frosted glass surfaces with multi-layered backdrops.
- **Neo-Brutalism:** High-contrast bordered badges (`.badge-ok`, `.badge-warn`, `.badge-err`) ensuring instantaneous cognitive status clarity.

---
*Authored by Jatin Sharma ([https://jatinsh.netlify.app/](https://jatinsh.netlify.app/))*
