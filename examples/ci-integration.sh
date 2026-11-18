#!/usr/bin/env bash
set -euo pipefail

echo "⚡ Running BenchPulse CI validation pipeline..."
node dist/bin.js --version
echo "✔ BenchPulse executable verified."
