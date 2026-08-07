import type { LebanonAddressValidationResult, LebanonAddressValue } from "./addressTypes";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildDisplayAddress(value: Pick<LebanonAddressValue, "mohafaza" | "qaza" | "village" | "exactAddress">): string {
  return [value.mohafaza, value.qaza, value.village, value.exactAddress].map(clean).filter(Boolean).join(" - ");
}

export function normalizeLebanonAddressValue(value: Partial<LebanonAddressValue> | string | null | undefined): LebanonAddressValue {
  if (typeof value === "string") {
    const exactAddress = clean(value);
    return {
      mohafaza: "",
      qaza: "",
      village: "",
      exactAddress,
      displayAddress: exactAddress,
      source: "legacy-string",
      status: exactAddress ? "partial" : "empty",
    };
  }

  const mohafaza = clean(value?.mohafaza);
  const qaza = clean(value?.qaza);
  const village = clean(value?.village);
  const exactAddress = clean(value?.exactAddress);
  const displayAddress = clean(value?.displayAddress) || buildDisplayAddress({ mohafaza, qaza, village, exactAddress });

  return {
    mohafaza,
    qaza,
    village,
    exactAddress,
    displayAddress,
    source: clean(value?.source) || "selector",
    status: clean(value?.status) || (displayAddress ? "partial" : "empty"),
  };
}

export function validateLebanonAddressValue(value: Partial<LebanonAddressValue> | string | null | undefined): LebanonAddressValidationResult {
  const normalized = normalizeLebanonAddressValue(value);
  const issues: string[] = [];

  if (normalized.village && !normalized.qaza) {
    issues.push("VILLAGE_WITHOUT_QAZA");
  }

  if (normalized.qaza && !normalized.mohafaza) {
    issues.push("QAZA_WITHOUT_MOHAFAZA");
  }

  if (!normalized.displayAddress) {
    issues.push("EMPTY_ADDRESS");
  }

  return {
    ok: issues.length === 0 || (issues.length === 1 && issues[0] === "EMPTY_ADDRESS"),
    value: normalized,
    issues,
  };
}