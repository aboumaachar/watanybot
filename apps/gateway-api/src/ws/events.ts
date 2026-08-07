/**
 * WebSocket event type definitions.
 */
import type { WSEventType, WSEvent } from "@watany/types";

export function createWSEvent<T>(type: WSEventType, payload: T): WSEvent<T> {
  return {
    type,
    payload,
    timestamp: Date.now(),
  };
}
