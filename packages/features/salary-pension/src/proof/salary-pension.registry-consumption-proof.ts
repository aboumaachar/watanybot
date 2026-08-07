import { createSalaryPensionHostRegistration } from "../host-integration/salary-pension.host-registration";
export function proveSalaryPensionRegistryConsumption() { const registration = createSalaryPensionHostRegistration(); return { ok: registration.key === "salary-pension" && registration.manifest.replaceable === true && registration.settings.adminConfigurable === true, registration }; }
