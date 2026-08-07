import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

const WEB_PUSH_PROVIDER = "webpush" as const;
const LOCAL_VAPID_SUBJECT = "mailto:watanybot-local@localhost";
const LOCAL_VAPID_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "runtime",
  "webpush-vapid.json",
);

type WebPushKeyRecord = {
  subject: string;
  publicKey: string;
  privateKey: string;
};

export type WebPushSubscriptionInput = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type WebPushPublicConfig = {
  provider: typeof WEB_PUSH_PROVIDER;
  configured: boolean;
  publicKey?: string;
  subject?: string;
  source: "env" | "runtime_file" | "unconfigured";
  error?: string;
};

export type WebPushDeliveryPayload = {
  notificationId: string;
  recipientId: string;
  kind: string;
  title: string;
  body: string;
  route?: string;
};

export type WebPushDeliveryResult =
  | {
      status: "sent";
    }
  | {
      status: "retryable_failure" | "permanent_failure";
      error: string;
      statusCode?: number;
    };

type LoadedWebPushConfig = WebPushPublicConfig & {
  privateKey?: string;
};

let cachedConfig: LoadedWebPushConfig | null = null;

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberOrNull(value: unknown): number | null | undefined {
  if (value == null) {
    return value as null | undefined;
  }

  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function readRuntimeVapidFile(): WebPushKeyRecord | null {
  if (!fs.existsSync(LOCAL_VAPID_FILE)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(LOCAL_VAPID_FILE, "utf8")) as Record<string, unknown>;
    const subject = stringValue(parsed.subject);
    const publicKey = stringValue(parsed.publicKey);
    const privateKey = stringValue(parsed.privateKey);
    if (!subject || !publicKey || !privateKey) {
      return null;
    }

    return {
      subject,
      publicKey,
      privateKey,
    };
  } catch {
    return null;
  }
}

function writeRuntimeVapidFile(record: WebPushKeyRecord): void {
  fs.mkdirSync(path.dirname(LOCAL_VAPID_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_VAPID_FILE, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

function createRuntimeVapidFile(): WebPushKeyRecord {
  const generated = webpush.generateVAPIDKeys();
  const record: WebPushKeyRecord = {
    subject: LOCAL_VAPID_SUBJECT,
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
  };
  writeRuntimeVapidFile(record);
  return record;
}

function loadWebPushConfig(): LoadedWebPushConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const envPublicKey = stringValue(process.env.WEB_PUSH_VAPID_PUBLIC_KEY);
  const envPrivateKey = stringValue(process.env.WEB_PUSH_VAPID_PRIVATE_KEY);
  const envSubject = stringValue(process.env.WEB_PUSH_VAPID_SUBJECT) || LOCAL_VAPID_SUBJECT;

  if (envPublicKey && envPrivateKey) {
    cachedConfig = {
      provider: WEB_PUSH_PROVIDER,
      configured: true,
      publicKey: envPublicKey,
      privateKey: envPrivateKey,
      subject: envSubject,
      source: "env",
    };
    return cachedConfig;
  }

  if (process.env.NODE_ENV === "production") {
    cachedConfig = {
      provider: WEB_PUSH_PROVIDER,
      configured: false,
      source: "unconfigured",
      error: "webpush_provider_not_configured",
    };
    return cachedConfig;
  }

  const runtimeRecord = readRuntimeVapidFile() || createRuntimeVapidFile();
  cachedConfig = {
    provider: WEB_PUSH_PROVIDER,
    configured: true,
    publicKey: runtimeRecord.publicKey,
    privateKey: runtimeRecord.privateKey,
    subject: runtimeRecord.subject,
    source: "runtime_file",
  };
  return cachedConfig;
}

function ensureVapidDetails(config: LoadedWebPushConfig): void {
  if (!config.configured || !config.publicKey || !config.privateKey || !config.subject) {
    return;
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
}

export function getWebPushPublicConfig(): WebPushPublicConfig {
  const config = loadWebPushConfig();
  return {
    provider: WEB_PUSH_PROVIDER,
    configured: config.configured,
    publicKey: config.publicKey,
    subject: config.subject,
    source: config.source,
    error: config.error,
  };
}

export function normalizeWebPushSubscription(input: unknown): WebPushSubscriptionInput | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  const endpoint = stringValue(candidate.endpoint);
  if (!endpoint) {
    return null;
  }

  const keys = candidate.keys && typeof candidate.keys === "object"
    ? candidate.keys as Record<string, unknown>
    : null;
  const p256dh = stringValue(keys?.p256dh);
  const auth = stringValue(keys?.auth);
  if (!p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    expirationTime: numberOrNull(candidate.expirationTime),
    keys: {
      p256dh,
      auth,
    },
  };
}

export async function sendWebPushNotification(
  subscription: WebPushSubscriptionInput,
  payload: WebPushDeliveryPayload,
): Promise<WebPushDeliveryResult> {
  const config = loadWebPushConfig();
  if (!config.configured) {
    return {
      status: "retryable_failure",
      error: config.error || "webpush_provider_not_configured",
    };
  }

  ensureVapidDetails(config);

  const targetRoute = typeof payload.route === "string" && payload.route.startsWith("/")
    ? payload.route
    : "/notifications";
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: `${payload.notificationId}:${payload.recipientId}:${payload.kind}`,
    data: {
      route: targetRoute,
      notificationId: payload.notificationId,
    },
  });

  try {
    await webpush.sendNotification(subscription, body, {
      TTL: 300,
      urgency: "normal",
    });
    return { status: "sent" };
  } catch (error) {
    const next = error as { statusCode?: number; body?: string; message?: string };
    const statusCode = typeof next.statusCode === "number" ? next.statusCode : undefined;
    if (statusCode === 404 || statusCode === 410) {
      return {
        status: "permanent_failure",
        error: "webpush_subscription_invalid",
        statusCode,
      };
    }

    return {
      status: "retryable_failure",
      error: statusCode
        ? `webpush_http_${statusCode}`
        : stringValue(next.body) || stringValue(next.message) || "webpush_delivery_failed",
      statusCode,
    };
  }
}
