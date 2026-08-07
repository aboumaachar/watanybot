import HybridKbChatWindow from "../components/chat/HybridKbChatWindow";

type HybridDefaultSurfaceProps = Record<string, unknown>;

export function HybridKbChatPage(props: HybridDefaultSurfaceProps) {
  void props;
  return <HybridKbChatWindow />;
}

export const hybridDefaultSourcePath = "apps/web-user/src/pages/hybrid-kb-chat.tsx";
export const hybridDefaultModuleKind = "page";

export default HybridKbChatPage;