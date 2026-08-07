import fs from "node:fs";
import path from "node:path";
import { getFlowsDir } from "./config.js";

/**
 * Read the Mermaid flow file for a given procedure ID.
 * Files are stored as `flows/PROC-024.mmd` (or just `proc_024.mmd`).
 */
export function getFlowText(
  procedureId: string,
): { ok: boolean; text?: string; error?: string } {
  const dir = getFlowsDir();

  // Try multiple naming conventions
  const candidates = [
    `${procedureId}.mmd`,
    `${procedureId.toUpperCase()}.mmd`,
    `PROC-${procedureId.replace(/^proc_0*/, "")}.mmd`,
  ];

  for (const name of candidates) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) {
      return { ok: true, text: fs.readFileSync(p, "utf-8") };
    }
  }

  return { ok: false, error: "flow_not_found" };
}
