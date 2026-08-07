import { WatanyHybridDefaultChat } from "../features/hybrid-chat/WatanyHybridDefaultChat";

type HybridDefaultSurfaceProps = Record<string, unknown>;

export function ChatPopup(props: HybridDefaultSurfaceProps) {
  return (
    <WatanyHybridDefaultChat
      {...props}
      surfaceId="chat-popup"
      title="مساعد موطني"
      preserveCommunityChat={true}
    />
  );
}

export const hybridDefaultSourcePath = "apps/web-user/src/components/ChatPopup.tsx";
export const hybridDefaultModuleKind = "component";

export default ChatPopup;