import { z } from "zod";

const TARGETS = {
  public: "https://koudama.com/mcp/api/chat",
  direct: "http://127.0.0.1:4001/api/chat",
};

const COMMON_BAD_REPLIES = [
  "تمام، ما في مشكلة. شو بتحب تعمل؟",
  "ماشي! إذا بدك شي تاني أنا هون.",
];

const queryCaseSchema = z.object({
  canonical: z.string().min(1),
  variants: z.array(z.string().min(1)).min(1),
});

const smokeSuiteConfigSchema = z.object({
  suiteName: z.string().min(1),
  defaultTargetEnv: z.string().min(1),
  defaultTargetFallback: z.enum(["public", "direct"]).optional(),
  urlEnvName: z.string().min(1),
  domainTerms: z.array(z.string().min(1)).default([]),
  additionalKnownBadReplies: z.array(z.string().min(1)).optional(),
  requiredReplyTermsAll: z.array(z.string().min(1)).optional(),
  forbiddenReplyTerms: z.array(z.string().min(1)).optional(),
  queryCases: z.array(queryCaseSchema).min(1),
});

export function validateSmokeSuiteConfig(config) {
  return smokeSuiteConfigSchema.parse(config);
}

export async function loadSmokeSuiteConfig(configUrl) {
  const imported = await import(configUrl, { with: { type: "json" } });
  return validateSmokeSuiteConfig(imported.default);
}

export async function runSmokeSuiteFromConfig(configUrl) {
  const config = await loadSmokeSuiteConfig(configUrl);

  return runSmokeSuite({
    suiteName: config.suiteName,
    defaultTarget: process.env[config.defaultTargetEnv] || config.defaultTargetFallback || "public",
    envUrlName: config.urlEnvName,
    queryCases: config.queryCases,
    validateResult: createCommonValidator({
      domainTerms: config.domainTerms || [],
      additionalKnownBadReplies: config.additionalKnownBadReplies || [],
      requiredReplyTermsAll: config.requiredReplyTermsAll || [],
      forbiddenReplyTerms: config.forbiddenReplyTerms || [],
    }),
  });
}

async function requestChat(url, query) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ message: query }),
  });

  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

function parseArgs(argv, defaultTarget, envUrlName) {
  const parsed = { target: defaultTarget, url: process.env[envUrlName] || null };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--target" && argv[index + 1]) {
      parsed.target = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--url" && argv[index + 1]) {
      parsed.url = argv[index + 1];
      index += 1;
      continue;
    }
    if (!value.startsWith("--") && index === 0) {
      parsed.url = value;
    }
  }

  return parsed;
}

function resolveUrl(target, explicitUrl) {
  if (explicitUrl) return explicitUrl;
  return TARGETS[target] || TARGETS.public;
}

export function createCommonValidator(options) {
  const domainTerms = options.domainTerms || [];
  const knownBadReplies = new Set([...COMMON_BAD_REPLIES, ...(options.additionalKnownBadReplies || [])]);
  const requiredReplyTermsAll = options.requiredReplyTermsAll || [];
  const forbiddenReplyTerms = options.forbiddenReplyTerms || [];

  return function validateResult(result) {
    if (!result.ok) {
      return `HTTP ${result.status}`;
    }

    const reply = String(result.body?.reply || "").trim();
    if (!reply) {
      return "empty reply";
    }

    if (knownBadReplies.has(reply)) {
      return "returned generic fallback reply";
    }

    if (result.body?.debug?.chitchat) {
      return `matched chitchat=${result.body.debug.chitchat}`;
    }

    for (const term of requiredReplyTermsAll) {
      if (!reply.includes(term)) {
        return `reply missing required term: ${term}`;
      }
    }

    for (const term of forbiddenReplyTerms) {
      if (reply.includes(term)) {
        return `reply contains forbidden term: ${term}`;
      }
    }

    if (domainTerms.length > 0 && !domainTerms.some((term) => reply.includes(term))) {
      return "reply missing expected domain language";
    }

    return null;
  };
}

export async function runSmokeSuite(options) {
  const args = parseArgs(process.argv.slice(2), options.defaultTarget, options.envUrlName);
  const url = resolveUrl(args.target, args.url);
  const failures = [];

  console.log(`${options.suiteName} target: ${args.target} -> ${url}`);

  for (const queryCase of options.queryCases) {
    for (const query of queryCase.variants) {
      try {
        const result = await requestChat(url, query);
        const error = options.validateResult(result, query, queryCase);
        const summary = {
          canonical: queryCase.canonical,
          query,
          status: result.status,
          reply: result.body?.reply || result.body?.error || result.body?.raw || "",
          debug: result.body?.debug || null,
        };

        console.log(JSON.stringify(summary, null, 2));

        if (error) {
          failures.push({ canonical: queryCase.canonical, query, error, summary });
        }
      } catch (error) {
        failures.push({
          canonical: queryCase.canonical,
          query,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (failures.length > 0) {
    console.error(`${options.suiteName} FAILED`);
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(`${options.suiteName} PASSED`);
}