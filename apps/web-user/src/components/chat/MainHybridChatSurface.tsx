import HybridKbChatWindow from "./HybridKbChatWindow";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./hybrid-kb-chat.css";

export type MainHybridChatSurfaceProps = Readonly<{
  context?: string;
  onClose?: () => void;
}>;

export function MainHybridChatSurface({ context = "main-chat", onClose }: MainHybridChatSurfaceProps) {
  return (
    <section className="main-hybrid-chat-surface" data-main-hybrid-chat-surface="true" data-main-hybrid-chat-context={context} dir="auto">
      <HybridKbChatWindow onClose={onClose} />
    </section>
  );
}

export default MainHybridChatSurface;
