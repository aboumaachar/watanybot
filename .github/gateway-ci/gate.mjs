// Pass/fail gate for the gateway vitest JSON report.
//
// Usage: node .github/gateway-ci/gate.mjs <vitest-report.json> [expected-skips.json]
//
// vitest 1.x counts skipped tests inside numPassedTests and leaves them out of
// numPendingTests, so the summary counters cannot see a skip. This gate reads
// every assertion's status instead and fails on:
//   - a missing or unreadable report, or success !== true
//   - any failed, pending or todo test, or any test file that failed to run
//   - any skipped test not listed in expected-skips.json
//   - fewer passed tests than expected-skips.json "minPassed" (lost tests)
import fs from "node:fs";
import path from "node:path";

const reportPath = process.argv[2];
const skipsPath = process.argv[3] || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "expected-skips.json");

function fail(msg) {
  console.error(`GATE FAIL: ${msg}`);
  process.exitCode = 1;
}

if (!reportPath || !fs.existsSync(reportPath)) {
  console.error(`GATE FAIL: vitest report not found: ${reportPath}`);
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const expected = JSON.parse(fs.readFileSync(skipsPath, "utf8"));
const allowedSkips = new Set(expected.skipped);

const counts = {};
const unexpectedSkips = [];
const seenSkips = new Set();
const problems = [];

for (const file of report.testResults || []) {
  const rel = file.name.replace(/\\/g, "/").split("/apps/gateway-api/").pop();
  if (file.status !== "passed") {
    problems.push(`file ${file.status}: ${rel} ${(file.message || "").split("\n")[0]}`);
  }
  for (const a of file.assertionResults || []) {
    counts[a.status] = (counts[a.status] || 0) + 1;
    const key = `${rel} :: ${a.fullName}`;
    if (a.status === "passed") continue;
    if (a.status === "skipped") {
      seenSkips.add(key);
      if (!allowedSkips.has(key)) unexpectedSkips.push(key);
      continue;
    }
    problems.push(`${a.status}: ${key}\n    ${(a.failureMessages || []).join("\n").split("\n").slice(0, 3).join("\n    ")}`);
  }
}

const passed = counts.passed || 0;
console.log(JSON.stringify({ files: (report.testResults || []).length, ...counts, minPassed: expected.minPassed, success: report.success }));

if (report.success !== true) fail("report.success is not true");
if (problems.length) fail(`${problems.length} failed/pending/todo test(s) or failed file(s):\n  ${problems.join("\n  ")}`);
if (unexpectedSkips.length) fail(`${unexpectedSkips.length} unexpected skipped test(s):\n  ${unexpectedSkips.join("\n  ")}`);
if (passed < expected.minPassed) fail(`passed ${passed} < minPassed ${expected.minPassed} (tests lost?)`);

const nowRunning = expected.skipped.filter((k) => !seenSkips.has(k));
if (nowRunning.length) {
  console.log(`note: ${nowRunning.length} expected skip(s) did not skip; remove them from expected-skips.json:\n  ${nowRunning.join("\n  ")}`);
}
if (!process.exitCode) console.log(`GATE PASS: ${passed} passed, ${seenSkips.size} expected skips`);
