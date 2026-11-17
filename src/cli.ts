import * as fs from 'node:fs';
import { BenchmarkRunner } from './core/runner.js';
import { BenchmarkConfig, SlaCriteria, BenchmarkResult } from './core/types.js';
import { MockHttpServer } from './core/mock-server.js';
import { StudioServer } from './server/studio.js';
import { compareRuns } from './core/comparator.js';
import {
  printBanner,
  printResultTable,
  printComparison,
  generateMarkdownReport,
  generateCsvExport,
  colors,
} from './utils/logger.js';

export async function runCli(argv: string[]): Promise<void> {
  const args = argv.slice(2);
  const command = args[0] || 'help';

  if (command === '-v' || command === '--version' || command === 'version') {
    process.stdout.write('BenchPulse v1.0.0\n');
    return;
  }

  if (command === '-h' || command === '--help' || command === 'help') {
    printBanner();
    process.stdout.write(`
${colors.bold}USAGE:${colors.reset}
  benchpulse run <url> [options]       Run concurrent HTTP benchmark against target URL
  benchpulse studio [--port 6363]      Launch embedded Bento Grid Web Studio
  benchpulse mock [--port 8899]        Launch standalone in-process HTTP mock harness
  benchpulse compare <runA> <runB>     Compare two benchmark JSON result files
  benchpulse help                      Show this documentation

${colors.bold}BENCHMARK OPTIONS:${colors.reset}
  -c, --concurrency <number>   Number of concurrent workers (default: 10)
  -d, --duration <seconds>     Duration of test in seconds (default: 10)
  -n, --requests <number>      Maximum total requests to execute (optional)
  -m, --method <verb>          HTTP method: GET, POST, PUT, DELETE (default: GET)
  -r, --rps <rate>             Rate limit ceiling in req/s (default: uncapped)
  -H, --header "K: V"          Custom request header (repeatable)
  --body <string>              Raw request body string
  --timeout <ms>               Request timeout in ms (default: 10000)

${colors.bold}SLA ASSERTION OPTIONS:${colors.reset}
  --max-p99 <ms>               Maximum permissible p99 latency in ms
  --max-mean <ms>              Maximum permissible mean latency in ms
  --min-rps <rate>             Minimum required throughput in req/s
  --max-error-rate <percent>   Maximum permissible error percentage

${colors.bold}OUTPUT FORMATS:${colors.reset}
  --json                       Emit raw JSON benchmark result
  --markdown                   Emit formatted Markdown performance report
  --csv                        Emit CSV performance metrics
  -o, --output <filepath>      Write result to specified file

${colors.bold}EXAMPLES:${colors.reset}
  $ benchpulse run http://127.0.0.1:8899 -c 20 -d 5
  $ benchpulse run https://api.example.com/v1/health -c 50 -d 30 --max-p99 45
  $ benchpulse studio --port 6363
  $ benchpulse mock --port 8899
\n`);
    return;
  }

  if (command === 'mock') {
    let port = 8899;
    const portIdx = args.indexOf('--port');
    if (portIdx !== -1 && args[portIdx + 1]) {
      port = parseInt(args[portIdx + 1], 10);
    }

    printBanner();
    const mock = new MockHttpServer({ port, minDelayMs: 2, maxDelayMs: 15 });
    const url = await mock.start();
    process.stdout.write(`\n${colors.green}✔ Mock HTTP server active on ${url}${colors.reset}\n`);
    process.stdout.write(`${colors.dim}Press Ctrl+C to terminate.${colors.reset}\n\n`);
    
    process.on('SIGINT', async () => {
      await mock.stop();
      process.stdout.write(`\n${colors.yellow}Mock server terminated.${colors.reset}\n`);
      process.exit(0);
    });
    return;
  }

  if (command === 'studio') {
    let port = 6363;
    const portIdx = args.indexOf('--port');
    if (portIdx !== -1 && args[portIdx + 1]) {
      port = parseInt(args[portIdx + 1], 10);
    }

    printBanner();
    const studio = new StudioServer({ port });
    const url = await studio.start();
    process.stdout.write(`\n${colors.cyan}${colors.bold}⚡ BenchPulse Bento Grid Studio is live!${colors.reset}\n`);
    process.stdout.write(`  ${colors.brightWhite}URL:${colors.reset} ${colors.green}${url}${colors.reset}\n`);
    process.stdout.write(`  ${colors.dim}Open the URL in your browser to inspect real-time percentiles and run benchmarks.${colors.reset}\n`);
    process.stdout.write(`  ${colors.dim}Press Ctrl+C to terminate.${colors.reset}\n\n`);

    process.on('SIGINT', async () => {
      await studio.stop();
      process.stdout.write(`\n${colors.yellow}BenchPulse Studio stopped.${colors.reset}\n`);
      process.exit(0);
    });
    return;
  }

  if (command === 'compare') {
    const fileA = args[1];
    const fileB = args[2];
    if (!fileA || !fileB) {
      process.stderr.write(`${colors.red}Error: Two JSON result filepaths required for comparison.${colors.reset}\n`);
      process.exit(1);
    }

    if (!fs.existsSync(fileA) || !fs.existsSync(fileB)) {
      process.stderr.write(`${colors.red}Error: One or both comparison files do not exist.${colors.reset}\n`);
      process.exit(1);
    }

    const runA: BenchmarkResult = JSON.parse(fs.readFileSync(fileA, 'utf-8'));
    const runB: BenchmarkResult = JSON.parse(fs.readFileSync(fileB, 'utf-8'));
    const diff = compareRuns(runA, runB);
    printComparison(diff);
    return;
  }

  if (command === 'run') {
    const targetUrl = args[1];
    if (!targetUrl || targetUrl.startsWith('-')) {
      process.stderr.write(`${colors.red}Error: Target URL must be provided. Example: benchpulse run http://127.0.0.1:8899${colors.reset}\n`);
      process.exit(1);
    }

    let concurrency = 10;
    let durationSec = 10;
    let totalRequests: number | undefined;
    let method: any = 'GET';
    let rpsLimit: number | undefined;
    let timeoutMs = 10000;
    let body: string | undefined;
    const headers: Record<string, string> = {};

    let maxP99Ms: number | undefined;
    let maxMeanMs: number | undefined;
    let minRps: number | undefined;
    let maxErrorRatePct: number | undefined;

    let isJson = false;
    let isMarkdown = false;
    let isCsv = false;
    let outputFile: string | undefined;

    for (let i = 2; i < args.length; i++) {
      const a = args[i];
      if (a === '-c' || a === '--concurrency') concurrency = parseInt(args[++i], 10);
      else if (a === '-d' || a === '--duration') durationSec = parseInt(args[++i], 10);
      else if (a === '-n' || a === '--requests') totalRequests = parseInt(args[++i], 10);
      else if (a === '-m' || a === '--method') method = args[++i].toUpperCase();
      else if (a === '-r' || a === '--rps') rpsLimit = parseInt(args[++i], 10);
      else if (a === '--timeout') timeoutMs = parseInt(args[++i], 10);
      else if (a === '--body') body = args[++i];
      else if (a === '-H' || a === '--header') {
        const headerArg = args[++i];
        const colonIdx = headerArg.indexOf(':');
        if (colonIdx !== -1) {
          headers[headerArg.slice(0, colonIdx).trim()] = headerArg.slice(colonIdx + 1).trim();
        }
      }
      else if (a === '--max-p99') maxP99Ms = parseFloat(args[++i]);
      else if (a === '--max-mean') maxMeanMs = parseFloat(args[++i]);
      else if (a === '--min-rps') minRps = parseFloat(args[++i]);
      else if (a === '--max-error-rate') maxErrorRatePct = parseFloat(args[++i]);
      else if (a === '--json') isJson = true;
      else if (a === '--markdown') isMarkdown = true;
      else if (a === '--csv') isCsv = true;
      else if (a === '-o' || a === '--output') outputFile = args[++i];
    }

    const config: BenchmarkConfig = {
      url: targetUrl,
      method,
      concurrency,
      durationSec,
      totalRequests,
      rpsLimit,
      timeoutMs,
      body,
      headers,
    };

    const slaCriteria: SlaCriteria | undefined = (maxP99Ms || maxMeanMs || minRps || maxErrorRatePct) ? {
      maxP99Ms,
      maxMeanMs,
      minRps,
      maxErrorRatePct,
    } : undefined;

    if (!isJson && !isMarkdown && !isCsv) {
      printBanner();
      process.stdout.write(`\n${colors.cyan}▶ Initiating benchmark against ${colors.bold}${method} ${targetUrl}${colors.reset}\n`);
      process.stdout.write(`  Workers: ${colors.bold}${concurrency}${colors.reset} | Duration: ${colors.bold}${durationSec}s${colors.reset} | RPS Limit: ${rpsLimit ? rpsLimit : 'Uncapped'}\n\n`);
    }

    const runner = new BenchmarkRunner(config, slaCriteria);
    const result = await runner.run((tick) => {
      if (!isJson && !isMarkdown && !isCsv) {
        process.stdout.write(`\r  [${Math.round(tick.elapsedMs / 1000)}s] Reqs: ${colors.bold}${tick.completedRequests}${colors.reset} | Throughput: ${colors.green}${tick.currentRps} req/s${colors.reset} | Errors: ${tick.errors > 0 ? colors.red : colors.gray}${tick.errors}${colors.reset}   `);
      }
    });

    if (!isJson && !isMarkdown && !isCsv) {
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      printResultTable(result);
    }

    if (isJson) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else if (isMarkdown) {
      process.stdout.write(generateMarkdownReport(result) + '\n');
    } else if (isCsv) {
      process.stdout.write(generateCsvExport(result) + '\n');
    }

    if (outputFile) {
      let outputContent = JSON.stringify(result, null, 2);
      if (outputFile.endsWith('.md')) outputContent = generateMarkdownReport(result);
      if (outputFile.endsWith('.csv')) outputContent = generateCsvExport(result);
      fs.writeFileSync(outputFile, outputContent, 'utf-8');
      if (!isJson && !isMarkdown && !isCsv) {
        process.stdout.write(`\n${colors.green}✔ Report saved to ${outputFile}${colors.reset}\n\n`);
      }
    }

    if (result.passedSla === false) {
      process.exit(1);
    }
    return;
  }

  process.stderr.write(`${colors.red}Unknown command: ${command}. Run "benchpulse help" for usage.${colors.reset}\n`);
  process.exit(1);
}
