export type GroupColorToken = {
  border: string;
  bg: string;
  text: string;
};

const GROUP_COLORS: Record<string, GroupColorToken> = {
  A: { border: "#dc2626", bg: "#fee2e2", text: "#7f1d1d" },
  B: { border: "#ea580c", bg: "#ffedd5", text: "#7c2d12" },
  C: { border: "#d97706", bg: "#fef3c7", text: "#78350f" },
  D: { border: "#65a30d", bg: "#ecfccb", text: "#365314" },
  E: { border: "#16a34a", bg: "#dcfce7", text: "#14532d" },
  F: { border: "#059669", bg: "#d1fae5", text: "#064e3b" },
  G: { border: "#0891b2", bg: "#cffafe", text: "#164e63" },
  H: { border: "#0284c7", bg: "#e0f2fe", text: "#0c4a6e" },
  I: { border: "#2563eb", bg: "#dbeafe", text: "#1e3a8a" },
  J: { border: "#4f46e5", bg: "#e0e7ff", text: "#312e81" },
  K: { border: "#9333ea", bg: "#f3e8ff", text: "#581c87" },
  L: { border: "#c026d3", bg: "#fae8ff", text: "#701a75" },
};

const DEFAULT_TOKEN: GroupColorToken = {
  border: "#64748b",
  bg: "#f1f5f9",
  text: "#334155",
};

export function getGroupKey(group?: string): string {
  const raw = typeof group === "string" ? group.trim() : "";
  const match = /^Group\s+([A-L])$/i.exec(raw);
  return match ? match[1].toUpperCase() : "";
}

export function getGroupColorToken(group?: string): GroupColorToken {
  const key = getGroupKey(group);
  return GROUP_COLORS[key] ?? DEFAULT_TOKEN;
}
