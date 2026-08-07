import { readdir } from "node:fs/promises";

import { loadSmokeSuiteConfig } from "./smoke_runner_lib.mjs";

const configDir = new URL("./configs/", import.meta.url);
const entries = await readdir(configDir, { withFileTypes: true });
const configFiles = entries.filter((entry) => entry.isFile() && entry.name.startsWith("smoke_") && entry.name.endsWith(".json"));

if (configFiles.length === 0) {
  console.error("No smoke config files found.");
  process.exit(1);
}

for (const file of configFiles) {
  const configUrl = new URL(file.name, configDir);
  const config = await loadSmokeSuiteConfig(configUrl);
  console.log(`Validated smoke config: ${file.name} -> ${config.suiteName}`);
}

console.log(`Validated ${configFiles.length} smoke config files.`);