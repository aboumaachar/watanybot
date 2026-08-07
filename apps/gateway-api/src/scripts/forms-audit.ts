import { getFormsCatalog, getFormsSourceRegistry } from "../data/forms-catalog";
import { buildFormsGovernanceReport } from "../lib/forms-governance-report";

const report = buildFormsGovernanceReport(getFormsCatalog(), getFormsSourceRegistry());

console.log(JSON.stringify(report, null, 2));

if (report.hasBlockingIssues) {
  process.exitCode = 1;
}
