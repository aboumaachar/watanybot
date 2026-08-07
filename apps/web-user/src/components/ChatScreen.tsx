import { WatanyHybridDefaultChat } from "../features/hybrid-chat/WatanyHybridDefaultChat";

type HybridDefaultSurfaceProps = Record<string, unknown>;

export function ChatScreen(props: HybridDefaultSurfaceProps) {
  return (
    <WatanyHybridDefaultChat
      {...props}
      surfaceId="chat-screen"
      title="مساعد موطني"
      preserveCommunityChat={true}
    />
  );
}

export const hybridDefaultSourcePath = "apps/web-user/src/components/ChatScreen.tsx";
export const hybridDefaultModuleKind = "component";

export default ChatScreen;