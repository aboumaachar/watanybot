import { WatanyHybridDefaultChat } from "../features/hybrid-chat/WatanyHybridDefaultChat";

type HybridDefaultSurfaceProps = Record<string, unknown>;

export function ChatFirstWindow(props: HybridDefaultSurfaceProps) {
  return (
    <WatanyHybridDefaultChat
      {...props}
      surfaceId="chat-first-window"
      title="مساعد موطني"
      preserveCommunityChat={true}
    />
  );
}

export const hybridDefaultSourcePath = "apps/web-user/src/components/ChatFirstWindow.tsx";
export const hybridDefaultModuleKind = "component";

export default ChatFirstWindow;