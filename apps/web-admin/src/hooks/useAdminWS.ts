import { useEffect, useRef, useState, useCallback } from "react";
import { ReliableWebSocketClient } from "@watany/shared/reliable-websocket";
import { getApiUrl } from "../lib/api";

export type WSMessage = {
  type: string;
  payload?: Record<string, unknown>;
  ts: string;
};

function getWsUrl(): string {
  return getApiUrl().replace(/^http/, "ws") + "/ws/admin";
}

export function useAdminWS(token: string | null) {
  const wsRef = useRef<ReliableWebSocketClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);

  const connect = useCallback(() => {
    if (!token) return;
    wsRef.current?.disconnect();

    const ws = new ReliableWebSocketClient(`${getWsUrl()}?token=${encodeURIComponent(token)}`, {
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onMessage: (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as WSMessage;
          setMessages((prev) => [msg, ...prev].slice(0, 200));
        } catch {
          // ignore non-JSON
        }
      },
    });

    wsRef.current = ws;
    ws.connect();
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.disconnect();
    };
  }, [connect]);

  const send = useCallback((type: string, payload?: Record<string, unknown>) => {
    wsRef.current?.sendJSON({ type, payload, ts: new Date().toISOString() });
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { connected, messages, send, clearMessages };
}
