"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { runCmdScript } = require("./cmd-transport");

const tokens = [];
const evidence = [];

function pass(token) {
  tokens.push(token);
  process.stdout.write(`${token}\n`);
}

function fail(token, detail, records = evidence) {
  const report = { status: "FAIL", failureToken: token, detail, probes: records };
  fs.writeFileSync(path.join(__dirname, "transport-proof-report.json"), JSON.stringify(report, null, 2));
  process.stderr.write(`${token} ${detail}\n`);
  process.exit(97);
}

function record(name, expected, actual) {
  evidence.push({ name, expected, actual });
}

function requireCondition(condition, token, detail) {
  if (!condition) fail(token, detail);
  pass(token);
}

function resolveExecutable(name) {
  const result = childProcess.spawnSync("where.exe", [name], {
    encoding: "utf8",
    shell: false,
    windowsHide: true
  });
  if (result.status !== 0) fail("APEX_REQUIRED_EXECUTABLE_MISSING", name);
  return result.stdout.split(/\r?\n/).map(value => value.trim()).find(Boolean);
}

const proofRoot = fs.mkdtempSync(path.join(os.tmpdir(), "APEX V1.0.25 Proof With Spaces "));
const helperPath = path.join(proofRoot, "helper with spaces.cmd");
const pnpmDirectory = path.join(proofRoot, "pnpm directory with spaces");
fs.mkdirSync(pnpmDirectory, { recursive: true });
fs.writeFileSync(path.join(pnpmDirectory, "package.json"), "{\"name\":\"apex-cmd-proof\",\"private\":true}\n", "utf8");
fs.writeFileSync(
  helperPath,
  [
    "@echo off",
    "setlocal EnableExtensions DisableDelayedExpansion",
    "echo APEX_HELPER_ENTRY",
    "echo APEX_HELPER_PATH=[%~f0]",
    "echo APEX_ARG_SPACE=[%~1]",
    "echo APEX_ARG_BACKSLASH=[%~2]",
    "echo APEX_ARG_EMPTY=[%~3]",
    "echo APEX_HELPER_STDERR 1>&2",
    "exit /b 23",
    ""
  ].join("\r\n"),
  "ascii"
);

const spacedArgument = "value containing spaces";
const backslashArgument = "C:\\path with spaces\\nested\\file.txt";
const helperResult = runCmdScript({
  target: helperPath,
  args: [spacedArgument, backslashArgument, ""],
  cwd: proofRoot
});
record("cmd-helper", { exitStatus: 23, shell: false }, helperResult);

requireCondition(helperResult.stdout.includes("APEX_HELPER_ENTRY"), "APEX_CMD_HELPER_ENTRY_PASS", "helper entry token missing");
requireCondition(helperResult.stdout.includes(`APEX_HELPER_PATH=[${helperPath}]`), "APEX_CMD_PATH_WITH_SPACES_PASS", "helper path with spaces changed");
requireCondition(helperResult.stdout.includes(`APEX_ARG_SPACE=[${spacedArgument}]`), "APEX_CMD_ARGUMENT_WITH_SPACES_PASS", "spaced argument changed");
requireCondition(helperResult.stdout.includes(`APEX_ARG_BACKSLASH=[${backslashArgument}]`), "APEX_CMD_BACKSLASH_ARGUMENT_PASS", "backslash argument changed");
requireCondition(helperResult.stdout.includes("APEX_ARG_EMPTY=[]"), "APEX_CMD_EMPTY_ARGUMENT_PASS", "empty argument changed");
requireCondition(helperResult.stdout.includes("APEX_HELPER_ENTRY"), "APEX_CMD_STDOUT_CAPTURE_PASS", "stdout not captured");
requireCondition(helperResult.stderr.includes("APEX_HELPER_STDERR"), "APEX_CMD_STDERR_CAPTURE_PASS", "stderr not captured");
requireCondition(helperResult.exitStatus === 23, "APEX_CMD_EXIT_23_PROPAGATION_PASS", `actual=${helperResult.exitStatus}`);

const pnpmExecutable = resolveExecutable("pnpm.cmd");
const pnpmVersionResult = runCmdScript({ target: pnpmExecutable, args: ["--version"], cwd: proofRoot });
record("pnpm-version", { exitStatus: 0, stdout: "nonempty", shell: false }, pnpmVersionResult);
requireCondition(pnpmVersionResult.exitStatus === 0 && pnpmVersionResult.stdout.trim().length > 0, "APEX_PNPM_VERSION_PROBE_PASS", `actual=${pnpmVersionResult.exitStatus}`);

const pnpmDirectoryResult = runCmdScript({
  target: pnpmExecutable,
  args: ["--dir", pnpmDirectory, "--version"],
  cwd: proofRoot
});
record("pnpm-dir-with-spaces", { exitStatus: 0, stdout: "nonempty", shell: false }, pnpmDirectoryResult);
requireCondition(pnpmDirectoryResult.exitStatus === 0 && pnpmDirectoryResult.stdout.trim().length > 0, "APEX_PNPM_DIR_WITH_SPACES_PROBE_PASS", `actual=${pnpmDirectoryResult.exitStatus}`);

const report = {
  status: "PASS",
  shell: false,
  powershellStartedByProof: false,
  proofRoot,
  tokens,
  probes: evidence
};
fs.writeFileSync(path.join(__dirname, "transport-proof-report.json"), JSON.stringify(report, null, 2));
pass("APEX_V1_0_25_WINDOWS_CMD_TRANSPORT_PASS");
fs.rmSync(proofRoot, { recursive: true, force: true });