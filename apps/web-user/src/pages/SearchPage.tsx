import { Navigate, useLocation } from "react-router-dom";
import { resolveContextualChat } from "../features/chat/contextualChatRuntime";

type SearchPageProps = Readonly<{
  onAddMessage?: (msg: unknown) => void;
}>;

export default function SearchPage(_props: SearchPageProps) {
  const location = useLocation();

  return (
    <Navigate
      to="/hybrid-kb-chat"
      replace
      state={{
        originPath: "/search",
        draft: typeof location.state === "object" && location.state && "draft" in location.state ? (location.state as { draft?: string }).draft || "" : "",
        chatContext: resolveContextualChat("/search"),
      }}
    />
  );
}

