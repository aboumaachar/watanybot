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
  const values = new Map(
    env.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['\"]|['\"]$/g, '')];
      }),
  );
  const requiredKeys = ['USE_AI_PROVIDER', 'AI_PROVIDER', 'AI_BASE_URL', 'AI_MODEL'];
  for (const key of requiredKeys) {
    const value = values.get(key);
    if (!value) fail(`.env missing required ${profile} key: ${key}`);
    else ok(`.env contains ${key}`);
  }
  if ((values.get('USE_AI_PROVIDER') || '').toLowerCase() !== 'true') {
    fail('.env must set USE_AI_PROVIDER=true');
  }
  const provider = (values.get('AI_PROVIDER') || '').toLowerCase();
  const supportedProviders = new Set(['ollama', 'deepseek', 'openai', 'azure', 'custom']);
  if (provider && !supportedProviders.has(provider)) fail(`.env has unsupported AI_PROVIDER: ${provider}`);
  else if (provider) ok(`AI_PROVIDER is supported: ${provider}`);

  const aiBaseUrl = values.get('AI_BASE_URL') || '';
  if (aiBaseUrl) {
    try {
      const parsed = new URL(aiBaseUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) fail('.env AI_BASE_URL must use http or https');
      if (profile === 'production' && provider === 'ollama' && !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
        fail('.env production Ollama AI_BASE_URL must be loopback');
      } else {
        ok('AI_BASE_URL is structurally valid');
      }
    } catch {
      fail('.env AI_BASE_URL is not a valid URL');
    }
  }

  if (profile === 'production') {
    const sttProvider = (values.get('STT_PROVIDER') || '').toLowerCase();
    const ttsProvider = (values.get('TTS_PROVIDER') || '').toLowerCase();
    if (sttProvider && !['openai', 'local'].includes(sttProvider)) fail(`.env has unsupported STT_PROVIDER: ${sttProvider}`);
    if (ttsProvider && !['openai', 'azure', 'voicerss', 'google'].includes(ttsProvider)) fail(`.env has unsupported TTS_PROVIDER: ${ttsProvider}`);
    if (sttProvider === 'local' && !values.get('WHISPER_SERVICE_URL')) fail('.env local STT requires WHISPER_SERVICE_URL');
    if (sttProvider || ttsProvider) ok('optional voice provider configuration is internally consistent');
    else ok('voice providers are intentionally unconfigured and must remain runtime-classified');
  }
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