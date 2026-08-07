const TARGETS = {
  production: "https://koudama.com/mcp",
  local: "http://127.0.0.1:8010",
  "server-local": "http://127.0.0.1:8015",
};

const DEFAULT_BASE_URL = TARGETS.production;
const DEFAULT_TEXT = "مرحبا هذا اختبار صوتي";

function parseArgs(argv) {
  const parsed = {
    target: process.env.PRODUCTION_SMOKE_TARGET || "production",
    baseUrl: process.env.PRODUCTION_SMOKE_BASE_URL || DEFAULT_BASE_URL,
    text: process.env.PRODUCTION_SMOKE_TEXT || DEFAULT_TEXT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--base-url" && argv[index + 1]) {
      parsed.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--target" && argv[index + 1]) {
      parsed.target = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--text" && argv[index + 1]) {
      parsed.text = argv[index + 1];
      index += 1;
    }
  }

  if (!process.env.PRODUCTION_SMOKE_BASE_URL && TARGETS[parsed.target]) {
    parsed.baseUrl = TARGETS[parsed.target];
  }

  return parsed;
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json = null;

  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { response, json, text };
}

async function run() {
  const { baseUrl, target, text } = parseArgs(process.argv.slice(2));
  const failures = [];

  const health = await fetchJson(`${baseUrl}/health`);
  const ready = await fetchJson(`${baseUrl}/ready`);
  const version = await fetchJson(`${baseUrl}/version`);
  const voiceHealth = await fetchJson(`${baseUrl}/api/voice/health`);

  if (!health.response.ok) failures.push(`health HTTP ${health.response.status}`);
  if (!ready.response.ok) failures.push(`ready HTTP ${ready.response.status}`);
  if (!version.response.ok) failures.push(`version HTTP ${version.response.status}`);
  if (!voiceHealth.response.ok) failures.push(`voice health HTTP ${voiceHealth.response.status}`);

  const ttsResponse = await fetch(`${baseUrl}/api/tts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, lang: "ar" }),
  });
  const ttsBuffer = Buffer.from(await ttsResponse.arrayBuffer());

  if (!ttsResponse.ok) {
    failures.push(`tts HTTP ${ttsResponse.status}`);
  }
  if (ttsBuffer.length === 0) {
    failures.push("tts returned empty audio");
  }

  const voiceChat = await fetchJson(`${baseUrl}/api/voice/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      audio: ttsBuffer.toString("base64"),
      mime: "audio/mpeg",
      lang: "ar",
      channel: "voice",
      sessionId: "prod-smoke",
      userId: "copilot",
    }),
  });

  if (!voiceChat.response.ok) {
    failures.push(`voice chat HTTP ${voiceChat.response.status}`);
  }
  if (!voiceChat.json?.ok) {
    failures.push(`voice chat failed: ${voiceChat.json?.error || "unknown error"}`);
  }

  const summary = {
    target,
    baseUrl,
    health: { status: health.response.status, body: health.json },
    ready: { status: ready.response.status, body: ready.json },
    version: { status: version.response.status, body: version.json },
    voiceHealth: { status: voiceHealth.response.status, body: voiceHealth.json },
    voiceE2E: {
      ttsStatus: ttsResponse.status,
      ttsBytes: ttsBuffer.length,
      voiceStatus: voiceChat.response.status,
      ok: voiceChat.json?.ok ?? false,
      transcript: voiceChat.json?.transcript || null,
      reply: typeof voiceChat.json?.reply === "string" ? voiceChat.json.reply.slice(0, 240) : null,
      spokenText: typeof voiceChat.json?.spokenText === "string" ? voiceChat.json.spokenText.slice(0, 240) : null,
      audioBytes: voiceChat.json?.audio?.base64 ? Buffer.byteLength(voiceChat.json.audio.base64, "base64") : 0,
      sttProvider: voiceChat.json?.meta?.sttProvider || null,
      ttsProvider: voiceChat.json?.meta?.ttsProvider || null,
      totalMs: voiceChat.json?.meta?.timings?.totalMs || null,
    },
    failures,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

try {
  await run();
} catch (error) {
  console.error(error);
  process.exit(1);
}