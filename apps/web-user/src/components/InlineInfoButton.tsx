import { useEffect, useId, useRef, useState } from "react";
import { QuestionCircle24Regular } from "../theme/watany-v4/legacyIconBridge";

type InlineInfoButtonProps = {
  text: string;
  label?: string;
  className?: string;
  hideIcon?: boolean;
};

export default function InlineInfoButton({
  text,
  label = "عرض التوضيح",
  className = "",
  hideIcon = false,
}: Readonly<InlineInfoButtonProps>) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!(event.target instanceof Node)) return;
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span className={`inline-info ${className}`.trim()} ref={wrapperRef}>
      <button
        type="button"
        className="inline-info__button"
        aria-label={label}
        aria-controls={tooltipId}
        aria-expanded={open}
        title={label}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        {hideIcon ? null : <QuestionCircle24Regular aria-hidden="true" />}
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`inline-info__bubble${open ? " is-open" : ""}`}
      >
        {text}
      </span>
    </span>
  );
}


