import HybridKbChatWindow from "./HybridKbChatWindow";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./hybrid-kb-chat.css";

export type MainHybridChatSurfaceProps = Readonly<{
  context?: string;
}>;

export function MainHybridChatSurface({ context = "main-chat" }: MainHybridChatSurfaceProps) {
  return (
    <section className="main-hybrid-chat-surface" data-main-hybrid-chat-surface="true" data-main-hybrid-chat-context={context} dir="auto">
      <HybridKbChatWindow />
    </section>
  );
}

export default MainHybridChatSurface;
