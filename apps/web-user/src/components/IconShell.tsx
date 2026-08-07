import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type IconShellProps = Readonly<{
  children: ReactNode;
  shellSize?: number;
  glyphSize?: number;
  radius?: number;
  borderWidth?: number;
  toneColor?: string;
}> & HTMLAttributes<HTMLSpanElement>;

export function IconShell({
  children,
  className,
  shellSize,
  glyphSize,
  radius,
  borderWidth,
  toneColor,
  style,
  ...rest
}: IconShellProps) {
  const mergedStyle: CSSProperties = {
    ...(style ?? {}),
    ...(shellSize ? { ["--watany-icon-shell-size" as string]: `${shellSize}px` } : null),
    ...(glyphSize ? { ["--watany-icon-glyph-size" as string]: `${glyphSize}px` } : null),
    ...(radius ? { ["--watany-icon-shell-radius" as string]: `${radius}px` } : null),
    ...(borderWidth ? { ["--watany-icon-shell-border" as string]: `${borderWidth}px` } : null),
    ...(toneColor ? { ["--watany-icon-color" as string]: toneColor } : null),
  };

  return (
    <span className={["watany-icon-shell", className].filter(Boolean).join(" ")} style={mergedStyle} {...rest}>
      {children}
    </span>
  );
}