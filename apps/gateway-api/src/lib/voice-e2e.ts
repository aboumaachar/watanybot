/**
 * Voice E2E background job — periodic TTS→STT round-trip checks with alerting.
 * Extracted from server.ts.
 */
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

export type VoiceE2ECheckResult = {
  ts: string;
  ok: boolean;
  sampleText: string;
  transcript?: string;
  confidence?: number;
  durationMs?: number;
  error?: string;
};

export type VoiceE2EAlert = {
  ts: string;
  level: "warning" | "critical" | "info";
  message: string;
  payload?: unknown;
};

interface VoiceE2EConfig {
  slackWebhook?: string;
  alertWebhook?: string;
  smtp?: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    from?: string;
    to?: string | string[];
    secure?: boolean;
  };
}

interface VoiceE2EState {
  history: VoiceE2ECheckResult[];
  alerts: VoiceE2EAlert[];
  config: VoiceE2EConfig;
}

async function loadJsonFile<T>(p: string, fallback: T): Promise<T> {
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = await fs.promises.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile<T>(p: string, data: T) {
  const json = JSON.stringify(data, null, 2);
  try {
    const tmp = `${p}.tmp`;
    await fs.promises.writeFile(tmp, json, "utf8");
    await fs.promises.rename(tmp, p);
  } catch {
    try {
      await fs.promises.writeFile(p, json, "utf8");
    } catch {
      /* ignore */
    }
  }
}

interface VoiceE2EOptions {
  dataDir: string;
  host: string;
  port: number;
}

export function createVoiceE2EService(app: FastifyInstance, options: VoiceE2EOptions) {
  const { dataDir, host, port } = options;
  const voiceHistoryPath = path.join(dataDir, "voice_e2e_history.json");
  const voiceAlertsPath = path.join(dataDir, "voice_e2e_alerts.json");
  const voiceConfigPath = path.join(dataDir, "voice_e2e_config.json");

  const VOICE_E2E_INTERVAL_MIN = Number(process.env.VOICE_E2E_INTERVAL_MIN || "15");
  const VOICE_E2E_SAMPLE_TEXT = process.env.VOICE_E2E_SAMPLE_TEXT || "اختبار موطني E2E";
  const VOICE_E2E_ALERT_DEDUP_MIN = Number(process.env.VOICE_E2E_ALERT_DEDUP_MIN || "10");

  const state: VoiceE2EState = { history: [], alerts: [], config: {} };

  async function init() {
    state.history = await loadJsonFile<VoiceE2ECheckResult[]>(voiceHistoryPath, []);
    state.alerts = await loadJsonFile<VoiceE2EAlert[]>(voiceAlertsPath, []);
    state.config = await loadJsonFile<VoiceE2EConfig>(voiceConfigPath, {});
  }

  async function sendAlert(alert: VoiceE2EAlert) {
    try {
      const last = state.alerts[0];
      if (last && last.level === alert.level) {
        const lastTs = new Date(last.ts).getTime();
        if (Date.now() - lastTs < VOICE_E2E_ALERT_DEDUP_MIN * 60 * 1000) {
          return { ok: true, skipped: true };
        }
      }

      state.alerts.unshift(alert);
      if (state.alerts.length > 200) state.alerts.pop();
      await writeJsonFile(voiceAlertsPath, state.alerts);

      const results: Array<Record<string, unknown>> = [];

      // Slack webhook
      const slackWebhook = state.config?.slackWebhook || process.env.VOICE_E2E_SLACK_WEBHOOK || "";
      if (slackWebhook) {
        try {
          const msg = `${alert.level.toUpperCase()}: ${alert.message} (ts=${alert.ts})`;
          await fetch(slackWebhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msg }) });
          results.push({ slack: "ok" });
        } catch (err) {
          results.push({ slack: "error", err: String(err) });
        }
      }

      // Generic webhook
      const generic = state.config?.alertWebhook || process.env.VOICE_E2E_ALERT_WEBHOOK || "";
      if (generic) {
        try {
          await fetch(generic, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alert, server: { host, port } }) });
          results.push({ webhook: "ok" });
        } catch (err) {
          results.push({ webhook: "error", err: String(err) });
        }
      }

      // SMTP
      const smtpConf = state.config?.smtp || (
        process.env.VOICE_E2E_SMTP_HOST ? {
          host: process.env.VOICE_E2E_SMTP_HOST,
          port: Number(process.env.VOICE_E2E_SMTP_PORT || 587),
          user: process.env.VOICE_E2E_SMTP_USER,
          pass: process.env.VOICE_E2E_SMTP_PASS,
          from: process.env.VOICE_E2E_SMTP_FROM,
          to: process.env.VOICE_E2E_ALERT_TO,
          secure: process.env.VOICE_E2E_SMTP_SECURE === "true",
        } : null
      );

      if (smtpConf && smtpConf.host && smtpConf.to) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpConf.host,
            port: smtpConf.port || 587,
            secure: !!smtpConf.secure,
            auth: smtpConf.user ? { user: smtpConf.user, pass: smtpConf.pass } : undefined,
          });
          const toList = Array.isArray(smtpConf.to) ? smtpConf.to.join(",") : String(smtpConf.to || "");
          const fromAddr = smtpConf.from || "watany@localhost";
          const info = await transporter.sendMail({
            from: fromAddr,
            to: toList,
            subject: `Watany voice alert — ${alert.level.toUpperCase()}`,
            text: `${alert.message}\n\n${JSON.stringify(alert.payload || {}, null, 2)}`,
          });
          results.push({ email: "ok", info: info.messageId || info.response });
        } catch (err) {
          results.push({ email: "error", err: String(err) });
        }
      }

      app.log.info({ alert, results }, "voice_e2e_alert_sent");
      return { ok: true, results };
    } catch (err) {
      app.log.error({ err }, "sendVoiceAlert_failed");
      return { ok: false, err: String(err) };
    }
  }

  async function runCheck(): Promise<VoiceE2ECheckResult> {
    const started = Date.now();
    const sampleText = VOICE_E2E_SAMPLE_TEXT;
    const result: VoiceE2ECheckResult = { ts: new Date().toISOString(), ok: false, sampleText };
    try {
      if (!process.env.OPENAI_API_KEY) {
        result.error = "STT not configured (OPENAI_API_KEY missing) — TTS available via fallback";
        state.history.unshift(result);
        if (state.history.length > 200) state.history.pop();
        await writeJsonFile(voiceHistoryPath, state.history);
        return result;
      }

      const ttsRes = await app.inject({ method: "POST", url: "/api/tts", payload: { text: sampleText, lang: "ar" } });
      if (ttsRes.statusCode !== 200) {
        result.error = `tts failed: ${ttsRes.statusCode}`;
        state.history.unshift(result);
        if (state.history.length > 200) state.history.pop();
        await writeJsonFile(voiceHistoryPath, state.history);
        await sendAlert({ ts: result.ts, level: "critical", message: result.error, payload: result });
        return result;
      }

      const audioBuffer = Buffer.from(ttsRes.rawPayload as Uint8Array);
      const base64 = audioBuffer.toString("base64");

      const sttRes = await app.inject({ method: "POST", url: "/api/stt", payload: { audio: base64, mime: "audio/mpeg", language: "ar" } });
      if (sttRes.statusCode !== 200) {
        result.error = `stt failed: ${sttRes.statusCode}`;
        state.history.unshift(result);
        if (state.history.length > 200) state.history.pop();
        await writeJsonFile(voiceHistoryPath, state.history);
        await sendAlert({ ts: result.ts, level: "critical", message: result.error, payload: result });
        return result;
      }

      const sttJson = JSON.parse(String(sttRes.payload || "{}"));
      result.transcript = sttJson.text || "";
      result.confidence = sttJson.confidence || 0;
      result.durationMs = Date.now() - started;

      const normalize = (s: string) => String(s || "").replace(/\s+/g, "").replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
      const pass = normalize(result.transcript || "").includes(normalize(sampleText));
      result.ok = pass || (result.confidence || 0) > 0.5;

      state.history.unshift(result);
      if (state.history.length > 200) state.history.pop();
      await writeJsonFile(voiceHistoryPath, state.history);

      if (!result.ok) {
        await sendAlert({ ts: result.ts, level: "warning", message: `E2E mismatch: ${result.transcript || "<empty>"}`, payload: result });
      }

      return result;
    } catch (err: unknown) {
      result.error = err instanceof Error ? err.message : String(err);
      result.durationMs = Date.now() - started;
      state.history.unshift(result);
      if (state.history.length > 200) state.history.pop();
      await writeJsonFile(voiceHistoryPath, state.history);
      await sendAlert({ ts: result.ts, level: "critical", message: result.error, payload: result });
      return result;
    }
  }

  function startScheduler() {
    if (process.env.NODE_ENV === "test") return;
    const intervalMs = Math.max(1, VOICE_E2E_INTERVAL_MIN) * 60 * 1000;
    setTimeout(() => {
      if (process.env.OPENAI_API_KEY) {
        runCheck().catch((e) => app.log.warn({ err: e }, "voice_e2e_initial_fail"));
        setInterval(() => runCheck().catch((e) => app.log.warn({ err: e }, "voice_e2e_sched_fail")), intervalMs);
      }
    }, 10000);
  }

  return {
    init,
    runCheck,
    sendAlert,
    startScheduler,
    getHistory: () => state.history,
    getAlerts: () => state.alerts,
    getConfig: () => state.config,
    setConfig: (newConfig: Partial<VoiceE2EConfig>) => {
      Object.assign(state.config, newConfig);
      writeJsonFile(voiceConfigPath, state.config).catch(() => {});
    },
  };
}

interface VoiceE2ERoutesOptions {
  voiceE2E: ReturnType<typeof createVoiceE2EService>;
}

export const voiceE2ERoutes: FastifyPluginAsync<VoiceE2ERoutesOptions> = async (app, { voiceE2E }) => {
  app.get("/api/admin/voice-checks", async () => ({
    ok: true,
    history: voiceE2E.getHistory().slice(0, 100),
  }));

  app.post("/api/admin/voice-checks/run", async () => {
    const r = await voiceE2E.runCheck();
    return { ok: true, result: r };
  });

  app.post("/api/admin/voice-checks/alert-test", async () => {
    const alert: VoiceE2EAlert = { ts: new Date().toISOString(), level: "info", message: "manual test alert", payload: { test: true } };
    const res = await voiceE2E.sendAlert(alert);
    return { ok: true, result: res };
  });

  app.get("/api/admin/voice-alerts", async () => ({
    ok: true,
    alerts: voiceE2E.getAlerts().slice(0, 200),
  }));

  app.get("/api/admin/voice-config", async () => {
    const config = voiceE2E.getConfig();
    return {
      ok: true,
      config: {
        ...config,
        smtp: config.smtp ? { ...config.smtp, pass: config.smtp.pass ? "*****" : undefined } : undefined,
      },
    };
  });

  app.post("/api/admin/voice-config", async (req) => {
    const body = (req.body || {}) as Partial<VoiceE2EConfig>;
    voiceE2E.setConfig(body);
    const config = voiceE2E.getConfig();
    return {
      ok: true,
      config: {
        ...config,
        smtp: config.smtp ? { ...config.smtp, pass: config.smtp.pass ? "*****" : undefined } : undefined,
      },
    };
  });
};
