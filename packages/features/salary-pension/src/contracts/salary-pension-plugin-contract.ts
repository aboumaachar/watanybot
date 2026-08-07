export type SalaryPensionPluginKey = "salary-pension";
export interface SalaryPensionSettings { pluginKey: SalaryPensionPluginKey; enabled: boolean; adminConfigurable: boolean; sourceAuthorityRequired: boolean; allowProductionReplacement: boolean; childFeatures: { calculator: boolean; pensionRules: boolean; deductions: boolean; medals: boolean; familyAllowances: boolean; officialSources: boolean; }; }
export interface SalaryPensionManifest { pluginKey: SalaryPensionPluginKey; displayName: string; version: string; exportable: boolean; replaceable: boolean; adminConfigurable: boolean; }
export interface SalaryPensionAdapter { getSettings(): SalaryPensionSettings; getManifest(): SalaryPensionManifest; }
