/**
 * Content filter rules — patterns that block internal data from leaking.
 */
import type { FilterRule } from "@watany/types";

/** Default built-in rules (can be overridden from DB). */
export const DEFAULT_RULES: FilterRule[] = [
  {
    id: "rule-system-prompt",
    name: "System Prompt Leak",
    pattern: "(system prompt|أنت موطني|قواعد المحادثة|AI_SYSTEM_PROMPT)",
    severity: "critical",
    action: "redact",
    enabled: true,
    description: "Blocks system prompt content from leaking to users",
  },
  {
    id: "rule-api-keys",
    name: "API Key Exposure",
    pattern: "(sk-[a-zA-Z0-9]{20,}|OPENAI_API_KEY|AI_API_KEY|JWT_SECRET)",
    severity: "critical",
    action: "block",
    enabled: true,
    description: "Blocks API keys and secrets",
  },
  {
    id: "rule-internal-markers",
    name: "Internal Markers",
    pattern: "(\\[INTERNAL\\]|\\[DEBUG\\]|\\[ADMIN_ONLY\\]|__internal__|__debug__)",
    severity: "high",
    action: "redact",
    enabled: true,
    description: "Removes internal debug markers",
  },
  {
    id: "rule-sql-injection",
    name: "SQL Injection Patterns",
    pattern: "(';\\s*DROP|UNION\\s+SELECT|--\\s*$|/\\*.*\\*/)",
    severity: "high",
    action: "block",
    enabled: true,
    description: "Blocks common SQL injection patterns",
  },
  {
    id: "rule-pii-military",
    name: "Military ID Exposure",
    pattern: "(MIL-\\d{4}-\\d{3,}|رقم عسكري:\\s*\\d+)",
    severity: "medium",
    action: "warn",
    enabled: true,
    description: "Warns when military IDs appear in responses",
  },
  {
    id: "rule-phone-numbers",
    name: "Phone Number in Response",
    pattern: "(\\+961[- ]?\\d[- ]?\\d{6,})",
    severity: "low",
    action: "warn",
    enabled: false,
    description: "Warns when phone numbers appear (disabled by default — many are intentional)",
  },
  {
    id: "rule-xss",
    name: "XSS Patterns",
    pattern: "(<script|javascript:|on\\w+\\s*=)",
    severity: "high",
    action: "block",
    enabled: true,
    description: "Blocks XSS attack patterns",
  },
];
