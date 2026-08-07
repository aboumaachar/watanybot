import fs from 'node:fs';
import path from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const next = process.argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, 'true');
    }
  }
}

const profile = args.get('profile') || 'local';
const rootArg = args.get('root') || process.cwd();
const root = path.resolve(rootArg);

function exists(p) { return fs.existsSync(p); }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function fail(message) { failures.push(message); }
function ok(message) { checks.push(message); }

function resolveGatewayRoot(base) {
  const candidates = [
    path.join(base, 'apps', 'gateway-api'),
    base,
  ];
  for (const candidate of candidates) {
    if (exists(path.join(candidate, 'src', 'routes', 'diagnostics.ts'))) return candidate;
  }
  return path.join(base, 'apps', 'gateway-api');
}

const failures = [];
const checks = [];
const gatewayRoot = resolveGatewayRoot(root);
const ecosystemPath = path.join(gatewayRoot, 'ecosystem.config.cjs');
const diagnosticsPath = path.join(gatewayRoot, 'src', 'routes', 'diagnostics.ts');
const envPath = path.join(gatewayRoot, '.env');
const startPath = path.join(gatewayRoot, 'start.sh');

if (!exists(gatewayRoot)) fail(`gateway root missing: ${gatewayRoot}`); else ok(`gateway root exists: ${gatewayRoot}`);
if (!exists(ecosystemPath)) fail(`ecosystem.config.cjs missing: ${ecosystemPath}`);
else {
  const ecosystem = read(ecosystemPath);
  if (!ecosystem.includes('watany-gateway')) fail('ecosystem.config.cjs does not define watany-gateway'); else ok('ecosystem defines watany-gateway');
  if (!ecosystem.includes('start.sh')) fail('ecosystem.config.cjs does not launch start.sh'); else ok('ecosystem launches start.sh');
}
if (!exists(startPath)) fail(`start.sh missing: ${startPath}`); else ok('start.sh exists');
if (!exists(diagnosticsPath)) fail(`diagnostics.ts missing: ${diagnosticsPath}`);
else {
  const diagnostics = read(diagnosticsPath);
  const routeNeedles = ['"/health"', '"/ready"', '"/version"', '"/api/health"', '"/api/ready"', '"/api/version"'];
  for (const needle of routeNeedles) {
    if (!diagnostics.includes(needle) && !diagnostics.includes(needle.split('\"').join("'"))) fail(`diagnostics.ts missing route ${needle}`);
    else ok(`diagnostics.ts has route ${needle}`);
  }
}
if (!exists(envPath)) fail(`.env missing: ${envPath}`);
else {
  const env = read(envPath);
  const requiredLocal = [
    'USE_AI_PROVIDER=true',
    'AI_PROVIDER=deepseek',
    'AI_BASE_URL=http://127.0.0.1:11434/v1',
    'OPENAI_BASE_URL=http://127.0.0.1:11434/v1',
    'OLLAMA_BASE_URL=http://127.0.0.1:11434',
    'AI_MODEL=deepseek-r1:8b',
    'OLLAMA_MODEL=deepseek-r1:8b',
  ];
  const requiredProduction = [
    ...requiredLocal,
    'STT_PROVIDER=local',
    'WHISPER_SERVICE_URL=http://127.0.0.1:8001/transcribe',
    'TTS_PROVIDER=google',
  ];
  for (const line of (profile === 'production' ? requiredProduction : requiredLocal)) {
    if (!env.includes(line)) fail(`.env missing required ${profile} key/value: ${line}`);
    else ok(`.env contains ${line.split('=')[0]}`);
  }
  if (/USE_AI_PROVIDER\s*=\s*false/i.test(env)) fail('.env contains USE_AI_PROVIDER=false');
}

const payload = {
  ok: failures.length === 0,
  profile,
  root,
  gatewayRoot,
  checks,
  failures,
};
console.log(JSON.stringify(payload, null, 2));
if (failures.length > 0) process.exit(1);