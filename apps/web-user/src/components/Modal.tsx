import React, { useEffect } from "react";
import { ArrowCounterclockwise24Regular, Dismiss24Regular } from "../theme/watany-v4/legacyIconBridge";

interface ModalProps {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  onRefresh?: () => void;
}

export function Modal({ open, title, children, onClose, onRefresh }: Readonly<ModalProps>) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <dialog open className="modal-backdrop">
      <div className="modal">
        <header className="modal-header">
          <h2>{title}</h2>
          <div className="modal-controls">
            {onRefresh && (
              <button className="icon-btn" type="button" onClick={onRefresh} title="Refresh" aria-label="تحديث">
                <ArrowCounterclockwise24Regular aria-hidden />
              </button>
            )}
            <button className="icon-btn" type="button" onClick={onClose} title="Close" aria-label="إغلاق">
              <Dismiss24Regular aria-hidden />
            </button>
          </div>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </dialog>
  );
}




