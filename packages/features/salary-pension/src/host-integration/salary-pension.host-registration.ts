import { createSalaryPensionDefaultAdapter } from "../adapter/salary-pension-default.adapter";
export function createSalaryPensionHostRegistration() { const adapter = createSalaryPensionDefaultAdapter(); return { key: "salary-pension", manifest: adapter.getManifest(), settings: adapter.getSettings(), status: "SAFE_MODULAR_BOUNDARY_READY" as const }; }
