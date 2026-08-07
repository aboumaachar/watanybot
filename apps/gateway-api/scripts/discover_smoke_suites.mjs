import { readdir } from "node:fs/promises";

import { loadSmokeSuiteConfig } from "./smoke_runner_lib.mjs";

const configDir = new URL("./configs/", import.meta.url);
const entries = await readdir(configDir, { withFileTypes: true });
const configFiles = entries
  .filter((entry) => entry.isFile() && entry.name.startsWith("smoke_") && entry.name.endsWith(".json"))
  .map((entry) => entry.name)
  .sort();

const suites = [];
for (const fileName of configFiles) {
  await loadSmokeSuiteConfig(new URL(fileName, configDir));
  suites.push(fileName.replace(/^smoke_/, "").replace(/\.json$/, "").replaceAll("_", "-"));
}

if (suites.length === 0) {
  console.error("No smoke suites discovered.");
  process.exit(1);
}

console.log(JSON.stringify(suites));