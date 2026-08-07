import { MutableRefObject, useEffect, useRef } from "react";

export function useLatestChatMessageFocus<TDependency>(
  dependency: TDependency,
  options?: { behavior?: ScrollBehavior; enabled?: boolean }
): MutableRefObject<HTMLDivElement | null> {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const enabled = options?.enabled ?? true;
  const behavior = options?.behavior ?? "smooth";

  useEffect(() => {
    if (!enabled) return;
    const frame = window.requestAnimationFrame(() => {
      anchorRef.current?.scrollIntoView({ block: "end", behavior });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dependency, enabled, behavior]);

  return anchorRef;
}