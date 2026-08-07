// APEX_CSS_FREEZE_DISABLED_IMPORT import "./WatanyDefaultHybridChatShell.css";
import { mountWatanyDefaultHybridChatShell } from "./WatanyDefaultHybridChatShell";

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountWatanyDefaultHybridChatShell, { once: true });
  } else {
    mountWatanyDefaultHybridChatShell();
  }
}
