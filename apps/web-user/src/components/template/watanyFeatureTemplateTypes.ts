import type { ReactNode } from "react";

export type WatanyFeatureCategory =
  | "general"
  | "service"
  | "procedure"
  | "benefits"
  | "jobs"
  | "market"
  | "legal"
  | "document"
  | "community"
  | "chat"
  | "updates"
  | "profile"
  | "admin"
  | "form";

export type WatanyFeatureActionVariant = "primary" | "secondary" | "ghost";

export type WatanyFeatureAction = Readonly<{
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: WatanyFeatureActionVariant;
  ariaLabel?: string;
  disabled?: boolean;
}>;

export type WatanyFeatureMetaItem = Readonly<{
  label: string;
  value: string;
}>;

export type WatanyFeatureTemplateProps = Readonly<{
  category?: WatanyFeatureCategory;
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: readonly WatanyFeatureAction[];
  meta?: readonly WatanyFeatureMetaItem[];
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}>;