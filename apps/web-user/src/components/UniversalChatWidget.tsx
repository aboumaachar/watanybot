import { WatanyHybridDefaultChat } from "../features/hybrid-chat/WatanyHybridDefaultChat";

type HybridDefaultSurfaceProps = Record<string, unknown>;

export function UniversalChatWidget(props: HybridDefaultSurfaceProps) {
  return (
    <WatanyHybridDefaultChat
      {...props}
      surfaceId="universal-chat-widget"
      title="مساعد موطني"
      preserveCommunityChat={true}
    />
  );
}

export const hybridDefaultSourcePath = "apps/web-user/src/components/UniversalChatWidget.tsx";
export const hybridDefaultModuleKind = "component";

export default UniversalChatWidget;