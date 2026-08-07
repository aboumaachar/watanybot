#!/usr/bin/env node

const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const gatewayRoot = path.join(repoRoot, "apps", "gateway-api");
const devPorts = [4000, 5174, 5175, 8012];

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function getSpawnCommand(command, args) {
  if (process.platform === "win32" && command.toLowerCase().endsWith(".cmd")) {
    return {
      command: process.env.comspec || "cmd.exe",
      args: ["/d", "/s", "/c", command, ...args],
    };
  }

  return { command, args };
}

function isPortBusy(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });

    socket.setTimeout(250);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
  });
}

async function getBusyDevPorts() {
  const busyPorts = [];

  for (const port of devPorts) {
    if (await isPortBusy(port)) {
      busyPorts.push(port);
    }
  }

  return busyPorts;
}

let packageJsonPath;

try {
  packageJsonPath = require.resolve("better-sqlite3/package.json", {
    paths: [gatewayRoot],
  });
} catch (error) {
  console.error("Failed to resolve better-sqlite3 from apps/gateway-api.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const packageRoot = path.dirname(packageJsonPath);

async function main() {
  const busyPorts = await getBusyDevPorts();

  if (busyPorts.length > 0) {
    console.error(
      `Stop local dev services before rebuilding better-sqlite3. Busy ports: ${busyPorts.join(", ")}`,
    );
    process.exit(1);
  }

  console.log(`Rebuilding better-sqlite3 in ${packageRoot}`);

  const spawnCommand = getSpawnCommand(getNpmCommand(), ["run", "build-release"]);

  const child = spawn(spawnCommand.command, spawnCommand.args, {
    cwd: packageRoot,
    stdio: "inherit",
    shell: false,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});