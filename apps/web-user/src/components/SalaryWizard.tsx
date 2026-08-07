import React, { createContext, useContext, useMemo } from "react";
import { useNavigateMode } from "../lib/routes";

type SalaryWizardContext = {
  open: () => void;
};

const SalaryWizardCtx = createContext<SalaryWizardContext | null>(null);

export function useSalaryWizard() {
  const ctx = useContext(SalaryWizardCtx);
  if (!ctx) throw new Error("useSalaryWizard must be used within SalaryWizardProvider");
  return ctx;
}

export function SalaryWizardProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const navigateMode = useNavigateMode();
  const value = useMemo(() => ({ open: () => navigateMode("salary") }), [navigateMode]);

  return <SalaryWizardCtx.Provider value={value}>{children}</SalaryWizardCtx.Provider>;
}
