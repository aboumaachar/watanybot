import { useState } from "react";
import { ChatPopup } from "../ChatPopup";

/**
 * FloatingBubbleLayout — FAB button + popup chat panel.
 * Page content renders behind; chat is always accessible via FAB.
 */
export function FloatingBubbleLayout({ children }: { readonly children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="layout-floating-bubble">
      <div className="ds-page-container">{children}</div>

      {/* Chat popup */}
      <ChatPopup open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* FAB — hidden when chat is open */}
      {!chatOpen && (
        <div className="chat-fab">
          <button
            className="ds-fab"
            onClick={() => setChatOpen(true)}
            title="فتح المحادثة"
            aria-label="Open chat"
          >
            محادثة
          </button>
        </div>
      )}
    </div>
  );
}
