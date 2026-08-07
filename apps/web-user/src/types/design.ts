/* ── Design System Types ── */

export type VisualTheme = "glassmorphism" | "neubrutalism" | "minimal-flat" | "neumorphism";
export type LayoutMode = "floating-bubble" | "command-palette" | "split-pane";
export type NavStyle = "bottom-tab-rail" | "hamburger" | "ai-driven";

export interface DesignConfig {
  theme: VisualTheme;
  layout: LayoutMode;
  nav: NavStyle;
}

export const THEME_LABELS: Record<VisualTheme, { ar: string; en: string; desc: string }> = {
  glassmorphism: {
    ar: "زجاجي حركي",
    en: "Glassmorphism + Motion",
    desc: "Frosted glass surfaces, blur backdrops, spring micro-animations. Modern premium feel.",
  },
  neubrutalism: {
    ar: "نيوبروتاليزم",
    en: "Neubrutalism",
    desc: "Bold borders, raw typography, high contrast, playful asymmetry. Distinctive & memorable.",
  },
  "minimal-flat": {
    ar: "مسطّح بسيط",
    en: "Minimal Flat",
    desc: "Clean flat cards, sharp corners, no shadows, solid colors. Accessibility-first.",
  },
  neumorphism: {
    ar: "نيومورفيزم",
    en: "Neumorphism",
    desc: "Soft shadows, embossed elements, muted palette. Elegant tactile feel.",
  },
};

export const LAYOUT_LABELS: Record<LayoutMode, { ar: string; en: string; desc: string }> = {
  "floating-bubble": {
    ar: "فقاعة عائمة",
    en: "Floating Bubble + Panel",
    desc: "WhatsApp/Intercom style. FAB button expands into a slide-up chat panel. Pages behind.",
  },
  "command-palette": {
    ar: "لوحة الأوامر",
    en: "Command Palette + Drawer",
    desc: "ChatGPT/Spotlight style. Search bar + centered overlay. Side drawer for panels.",
  },
  "split-pane": {
    ar: "شاشة مقسّمة",
    en: "Split Pane",
    desc: "Claude/Gemini style. Chat occupies left, context pane on right. Conversation-first.",
  },
};

export const NAV_LABELS: Record<NavStyle, { ar: string; en: string; desc: string }> = {
  "bottom-tab-rail": {
    ar: "شريط سفلي + جانبي",
    en: "Bottom Tabs + Rail",
    desc: "Icon-only rail on desktop, 5-tab bar on mobile. Chat FAB floats above.",
  },
  hamburger: {
    ar: "قائمة هامبرغر",
    en: "Hamburger Menu",
    desc: "Slide-out drawer for all pages. Contextual sub-tabs at top of active page.",
  },
  "ai-driven": {
    ar: "ملاحة ذكية",
    en: "AI-Driven Nav",
    desc: "No visible nav. Tell the chatbot what you need and it routes you automatically.",
  },
};

export const DEFAULT_DESIGN: DesignConfig = {
  theme: "glassmorphism",
  layout: "floating-bubble",
  nav: "bottom-tab-rail",
};
