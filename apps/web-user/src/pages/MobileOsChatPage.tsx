import { WatanyHybridDefaultChat } from "../features/hybrid-chat/WatanyHybridDefaultChat";

type HybridDefaultSurfaceProps = Record<string, unknown>;

export function MobileOsChatPage(props: HybridDefaultSurfaceProps) {
  return (
    <WatanyHybridDefaultChat
      {...props}
      surfaceId="mobile-os-chat-page"
      title="مساعد موطني"
      preserveCommunityChat={true}
    />
  );
}

export const hybridDefaultSourcePath = "apps/web-user/src/pages/MobileOsChatPage.tsx";
export const hybridDefaultModuleKind = "page";

export default MobileOsChatPage;