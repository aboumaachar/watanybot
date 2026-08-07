/**
 * Content filter engine — scans text against rules and takes action.
 */
import type { FilterRule, FilterResult, FilterSeverity, FilterAction } from "@watany/types";
import { DEFAULT_RULES } from "./rules.js";
import { query } from "../lib/db.js";

let cachedRules: FilterRule[] = [...DEFAULT_RULES];
let lastRefresh = 0;
const CACHE_TTL_MS = 60_000; // refresh from DB every 60s

/** Load rules from DB, merging with defaults. */
export async function refreshRules(): Promise<void> {
  try {
    const result = await query<{
      id: string;
      name: string;
      pattern: string;
      severity: string;
      action: string;
      enabled: boolean;
      description: string | null;
    }>("SELECT id, name, pattern, severity, action, enabled, description FROM filter_rules");

    if (result.rows.length > 0) {
      cachedRules = result.rows.map(r => ({
        id: r.id,
        name: r.name,
        pattern: r.pattern,
        severity: r.severity as FilterSeverity,
        action: r.action as FilterAction,
        enabled: r.enabled,
        description: r.description ?? undefined,
      }));
    } else {
      cachedRules = [...DEFAULT_RULES];
    }
    lastRefresh = Date.now();
  } catch {
    // DB not available — use defaults
    cachedRules = [...DEFAULT_RULES];
    lastRefresh = Date.now();
  }
}

/** Get current active rules. */
export function getActiveRules(): FilterRule[] {
  return cachedRules.filter(r => r.enabled);
}

/**
 * Filter text against all active rules.
 * Returns a result with pass/fail, violations, and sanitized output.
 */
export async function filterContent(text: string): Promise<FilterResult> {
  // Auto-refresh cache
  if (Date.now() - lastRefresh > CACHE_TTL_MS) {
    await refreshRules();
  }

  const violations: FilterResult["violations"] = [];
  let sanitized = text;

  for (const rule of getActiveRules()) {
    try {
      const regex = new RegExp(rule.pattern, "gi");
      const matches = text.match(regex);
      if (matches) {
        for (const match of matches) {
          violations.push({
            rule: rule.name,
            severity: rule.severity,
            action: rule.action,
            match,
          });
        }

        // Apply action
        if (rule.action === "redact") {
          sanitized = sanitized.replace(regex, "[محتوى محذوف]");
        } else if (rule.action === "block") {
          return {
            passed: false,
            violations,
            sanitized: "عذراً، لا يمكن عرض هذا المحتوى.",
          };
        }
      }
    } catch {
      // Invalid regex pattern — skip rule
    }
  }

  return {
    passed: violations.filter(v => v.action === "block").length === 0,
    violations,
    sanitized,
  };
}

/**
 * Sanitize user input (XSS prevention + basic cleanup).
 */
export function sanitizeInput(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .trim();
}
