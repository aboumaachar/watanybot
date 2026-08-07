import { runSmokeSuiteFromConfig } from "./smoke_runner_lib.mjs";

function resolveConfigUrl(suiteName) {
  const normalized = String(suiteName || "").trim();
  if (!normalized) {
    throw new Error("Missing suite name. Example: node ./scripts/run_smoke_suite.mjs family-pension --target public");
  }

  const configFile = `./configs/smoke_${normalized.replaceAll("-", "_")}.json`;
  return new URL(configFile, import.meta.url);
}

const [suiteName] = process.argv.slice(2);

if (!suiteName) {
  console.error("Missing suite name. Example: node ./scripts/run_smoke_suite.mjs family-pension --target public");
  process.exit(1);
}

process.argv.splice(2, 1);

await runSmokeSuiteFromConfig(resolveConfigUrl(suiteName));