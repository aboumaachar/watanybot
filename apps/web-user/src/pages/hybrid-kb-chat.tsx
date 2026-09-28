import { Navigate, useLocation } from "react-router-dom";

export function HybridKbChatPage() {
  const location = useLocation();
  const target = `/chat${location.search}${location.hash}`;
  return <Navigate to={target} replace state={location.state} />;
}

export const hybridKbChatCanonicalOwner = "/chat";
export const hybridKbChatCompatibilityAlias = true;

export default HybridKbChatPage;
