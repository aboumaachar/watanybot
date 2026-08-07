#!/usr/bin/env node

/**
 * WatanyBot Smart Dev Starter
 * 
 * Handles parallel service startup with:
 * - Staggered initialization (avoids port conflicts)
 * - Retry logic for transient failures
 * - Health check validation
 * - Graceful shutdown
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const STAGGER_DELAY_MS = 1000;
const HEALTH_CHECK_INTERVAL_MS = 1000;
const HEALTH_CHECK_TIMEOUT_MS = 45000;

const repoRoot = process.cwd();
const apiBackendRoot = path.join(repoRoot, "apps", "api-backend");

function getPnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function getPythonCommandCandidates() {
  if (process.platform === "win32") {
    return [
      path.join(repoRoot, ".venv", "Scripts", "python.exe"),
      path.join(apiBackendRoot, ".venv", "Scripts", "python.exe"),
      "python",
      "py",
    ];
  }

  return [
    path.join(repoRoot, ".venv", "bin", "python"),
    path.join(apiBackendRoot, ".venv", "bin", "python"),
    "python3",
    "python",
  ];
}

function resolveExecutable(candidates) {
  for (const candidate of candidates) {
    if (path.isAbsolute(candidate)) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      continue;
    }

    return candidate;
  }

  throw new Error(`No executable found. Checked: ${candidates.join(", ")}`);
}

function getSpawnCommand(service) {
  if (
    process.platform === "win32" &&
    typeof service.cmd === "string" &&
    service.cmd.toLowerCase().endsWith(".cmd")
  ) {
    return {
      cmd: process.env.comspec || "cmd.exe",
      args: ["/d", "/s", "/c", service.cmd, ...service.args],
    };
  }

  return {
    cmd: service.cmd,
    args: service.args,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await checkHealth(url)) {
      return true;
    }
    await sleep(HEALTH_CHECK_INTERVAL_MS);
  }

  return false;
}

const pnpmCommand = getPnpmCommand();
const pythonCommand = resolveExecutable(getPythonCommandCandidates());

// Service definitions
const SERVICES = [
  {
    name: "api-backend",
    cmd: pythonCommand,
    args: [
      "-m",
      "uvicorn",
      "apps.api.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      "8012",
    ],
    cwd: apiBackendRoot,
    port: 8012,
    healthUrl: "http://127.0.0.1:8012/health",
  },
  // Start gateway first so that web-user's dev proxy has a backend to target.
  {
    name: "gateway-api",
    cmd: pnpmCommand,
    args: ["--filter", "gateway-api", "dev"],
    cwd: repoRoot,
    port: 8010,
    healthUrl: "http://127.0.0.1:8010/health",
  },
  // web-user should be started after gateway is healthy to avoid Vite proxy probes failing.
  {
    name: "web-user",
    cmd: pnpmCommand,
    args: ["--filter", "web-user", "dev"],
    cwd: repoRoot,
    port: 5174,
    healthUrl: "http://127.0.0.1:5174",
  },
  {
    name: "web-admin",
    cmd: pnpmCommand,
    args: [
      "--filter",
      "web-admin",
      "exec",
      "vite",
      "--host",
      "127.0.0.1",
      "--port",
      "5175",
      "--strictPort",
    ],
    cwd: repoRoot,
    port: 5175,
    healthUrl: "http://127.0.0.1:5175",
  },
];

const processes = [];

// Health check helper
async function checkHealth(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Start a service with retry logic
async function startService(service, index) {
  // Stagger startup to avoid port conflicts
  const staggerDelay = index * STAGGER_DELAY_MS;
  await new Promise((resolve) => setTimeout(resolve, staggerDelay));

  let lastError = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(
        `[${service.name}] Starting (attempt ${attempt}/${RETRY_ATTEMPTS})...`
      );

      return new Promise((resolve, reject) => {
        const spawnCommand = getSpawnCommand(service);
        const proc = spawn(spawnCommand.cmd, spawnCommand.args, {
          stdio: "inherit",
          cwd: service.cwd ?? repoRoot,
          shell: false,
        });

        processes.push(proc);

        let settled = false;

        const rejectOnce = (error) => {
          if (settled) {
            return;
          }
          settled = true;
          reject(error);
        };

        const resolveOnce = () => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(proc);
        };

        proc.on("error", (err) => {
          lastError = err;
          console.error(`[${service.name}] Process error: ${err.message}`);
          if (attempt === RETRY_ATTEMPTS) {
            rejectOnce(err);
          } else {
            setTimeout(resolveOnce, RETRY_DELAY_MS);
          }
        });

        proc.on("exit", (code) => {
          if (settled) {
            return;
          }

          if (code !== 0 && code !== null) {
            lastError = new Error(`Process exited with code ${code}`);
            console.warn(`[${service.name}] Exited with code ${code}`);
            if (attempt === RETRY_ATTEMPTS) {
              rejectOnce(lastError);
            } else {
              setTimeout(resolveOnce, RETRY_DELAY_MS);
            }
            return;
          }

          rejectOnce(new Error(`[${service.name}] Process exited before health check completed.`));
        });

        waitForHealth(service.healthUrl, HEALTH_CHECK_TIMEOUT_MS)
          .then((isHealthy) => {
            if (isHealthy) {
              console.log(`[${service.name}] Healthy at ${service.healthUrl}`);
              resolveOnce();
              return;
            }

            lastError = new Error(
              `Health check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`
            );
            console.error(`[${service.name}] ${lastError.message}`);

            try {
              proc.kill();
            } catch {
              // Ignore shutdown errors while retrying startup.
            }

            if (attempt === RETRY_ATTEMPTS) {
              rejectOnce(lastError);
            } else {
              setTimeout(resolveOnce, RETRY_DELAY_MS);
            }
          })
          .catch((err) => {
            lastError = err;
            if (attempt === RETRY_ATTEMPTS) {
              rejectOnce(err);
            } else {
              setTimeout(resolveOnce, RETRY_DELAY_MS);
            }
          });
      });
    } catch (err) {
      if (attempt === RETRY_ATTEMPTS) {
        throw new Error(
          `[${service.name}] Failed after ${RETRY_ATTEMPTS} attempts: ${lastError?.message || err.message}`
        );
      }
    }
  }
}

// Main startup orchestration
async function startAllServices() {
  console.log("🚀 WatanyBot Development Environment");
  console.log(
    `Starting ${SERVICES.length} services with staggered initialization...\n`
  );

  try {
    // Start all services (with stagger delays)
    await Promise.all(
      SERVICES.map((service, index) => startService(service, index))
    );

    console.log("\n✅ All services started successfully!\n");
    console.log("Available endpoints:");
    SERVICES.forEach((service) => {
      const url = `http://127.0.0.1:${service.port}`;
      console.log(`  - ${service.name}: ${url}`);
    });
    console.log(
      "\n📝 Press Ctrl+C to stop all services\n"
    );
  } catch (error) {
    console.error("\n❌ Failed to start services:", error.message);
    cleanupAndExit(1);
  }
}

// Graceful shutdown
function cleanupAndExit(code = 0) {
  console.log("\n🛑 Shutting down services...");
  processes.forEach((proc) => {
    if (proc && !proc.killed) {
      proc.kill();
    }
  });
  process.exit(code);
}

// Setup signal handlers
process.on("SIGINT", () => cleanupAndExit(0));
process.on("SIGTERM", () => cleanupAndExit(0));

// Start services
startAllServices();
