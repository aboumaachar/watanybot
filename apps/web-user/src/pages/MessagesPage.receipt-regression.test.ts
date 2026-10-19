import { describe, expect, it } from "vitest";
import type { CommunityMessage } from "../types/domain";
import { mergeDirectMessages } from "./MessagesPage";

function message(receiptStatus?: CommunityMessage["receiptStatus"]): CommunityMessage {
  return {
    id: "direct-message-1",
    groupId: "direct-group-1",
    senderId: "user-a",
    senderName: "User A",
    senderRole: "user",
    type: "text",
    body: "hello",
    createdAt: "2026-09-26T08:00:00.000Z",
    receiptStatus,
  };
}

describe("direct message receipt merge regression", () => {
  it("does not downgrade read when a same-id payload omits receipt state", () => {
    const merged = mergeDirectMessages([message("read")], message());
    expect(merged).toHaveLength(1);
    expect(merged[0]?.receiptStatus).toBe("read");
  });

  it("keeps the highest receipt state across same-id merges", () => {
    expect(mergeDirectMessages([message("delivered")], message("sent"))[0]?.receiptStatus).toBe("delivered");
    expect(mergeDirectMessages([message("sent")], message("read"))[0]?.receiptStatus).toBe("read");
  });
});
