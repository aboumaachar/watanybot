import type { NavigateFunction } from "react-router-dom";

import type { CTAAction, WatanyModule } from "../types/domain";
import type { Mode } from "../store/app";
import { MODE_PATHS } from "./routes";

type ExecuteHybridActionOptions = {
  navigate: NavigateFunction;
  navigateMode: (mode: Mode) => void;
  onReply?: (query: string) => void;
};

type FlowTarget = WatanyModule | "home" | "groups" | "services" | "forms";

const MODULE_MODE_MAP: Partial<Record<FlowTarget, Mode>> = {
  assistant: "chat",
  community: "community",
  documents: "documents",
  forms: "procedures",
  home: "home",
  laws: "search",
  recruitment: "services",
  salary: "salary",
  services: "services",
};

const SERVICE_FLOW_FOCUS: Partial<Record<FlowTarget, string>> = {
  documents: "documents",
  forms: "forms",
  laws: "laws",
  payment: "payment",
  phonebook: "phonebook",
  procedure: "procedure",
  recruitment: "recruitment",
  salary: "salary",
};

function openExternalUrl(url: string) {
  globalThis.open(url, "_blank", "noopener,noreferrer");
}

function queryFromAction(action: CTAAction): string {
  return typeof action.payload?.query === "string" ? action.payload.query : action.label;
}

function targetFromAction(action: CTAAction): FlowTarget | undefined {
  if (typeof action.target === "string" && action.target.trim()) {
    return action.target as FlowTarget;
  }

  if (typeof action.payload?.moduleId === "string" && action.payload.moduleId.trim()) {
    return action.payload.moduleId as FlowTarget;
  }

  if (typeof action.payload?.mode === "string" && action.payload.mode.trim()) {
    return action.payload.mode as FlowTarget;
  }

  return undefined;
}

function groupPathFromAction(action: CTAAction): string {
  const groupId = typeof action.payload?.groupId === "string" ? action.payload.groupId.trim() : "";
  return groupId ? `/groups/${encodeURIComponent(groupId)}` : "/groups";
}

export function executeHybridAction(action: CTAAction, options: ExecuteHybridActionOptions): void {
  if (action.type === "reply") {
    const replyQuery = queryFromAction(action);
    if (options.onReply) {
      options.onReply(replyQuery);
      return;
    }

    options.navigate(MODE_PATHS.chat, { state: { draft: replyQuery } });
    return;
  }

  if (action.type === "call" && typeof action.payload?.phone === "string") {
    globalThis.location.href = `tel:${action.payload.phone}`;
    return;
  }

  if ((action.type === "download" || action.type === "share" || action.type === "join_session") && typeof action.payload?.url === "string") {
    openExternalUrl(action.payload.url);
    return;
  }

  if (action.type === "navigate" && typeof action.target === "string") {
    const nextTarget = action.target.trim();

    if (nextTarget.startsWith("/")) {
      options.navigate(nextTarget);
      return;
    }

    if (/^https?:\/\//i.test(nextTarget)) {
      openExternalUrl(nextTarget);
      return;
    }
  }

  const target = targetFromAction(action);

  if (action.type === "open_service_flow") {
    const focus = target ? SERVICE_FLOW_FOCUS[target] : undefined;
    options.navigate(MODE_PATHS.services, { state: focus ? { focus } : undefined });
    return;
  }

  if (target === "phonebook") {
    globalThis.dispatchEvent(new Event("watany-open-directory"));
    return;
  }

  if (target === "community_group" || target === "groups") {
    options.navigate(groupPathFromAction(action), {
      state: action.type === "join_session" ? { joinSession: true } : undefined,
    });
    return;
  }

  if (target === "services") {
    options.navigateMode("services");
    return;
  }

  if (target === "forms") {
    const rawQuery = typeof action.payload?.query === "string" ? action.payload.query.trim() : "";
    const path = rawQuery ? `/forms?q=${encodeURIComponent(rawQuery)}` : "/forms";
    options.navigate(path);
    return;
  }

  if (target === "payment") {
    options.navigate(MODE_PATHS.services, { state: { focus: SERVICE_FLOW_FOCUS.payment } });
    return;
  }

  if (target === "procedure") {
    options.navigate(MODE_PATHS.procedures, { state: { focus: SERVICE_FLOW_FOCUS.procedure } });
    return;
  }

  if (target === "support") {
    options.navigate(MODE_PATHS.chat, { state: { draft: "أريد متابعة بشرية" } });
    return;
  }

  if (target && MODULE_MODE_MAP[target]) {
    const mode = MODULE_MODE_MAP[target] as Mode;
    const focus = SERVICE_FLOW_FOCUS[target];

    if (focus) {
      options.navigate(MODE_PATHS[mode], { state: { focus } });
      return;
    }

    options.navigateMode(mode);
    return;
  }

  if (typeof action.payload?.mode === "string") {
    options.navigateMode(action.payload.mode as Mode);
  }
}