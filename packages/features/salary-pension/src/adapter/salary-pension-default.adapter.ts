import type { SalaryPensionAdapter } from "../contracts/salary-pension-plugin-contract";
import { defaultSalaryPensionSettings } from "../config/salary-pension-plugin-settings.defaults";
import { salaryPensionPluginManifest } from "../manifest/salary-pension-plugin.manifest";
export function createSalaryPensionDefaultAdapter(): SalaryPensionAdapter { return { getSettings: () => defaultSalaryPensionSettings, getManifest: () => salaryPensionPluginManifest }; }
