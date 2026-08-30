import { useEffect, useRef, useState, useCallback } from "react";
import { ReliableWebSocketClient } from "@watany/shared/reliable-websocket";
import { getApiUrl, refreshAdminAccessToken } from "../lib/api";

export type WSMessage = {
  type: string;
  payload?: Record<string, unknown>;
  ts: string;
};

function getWsUrl(): string {
  const apiUrl = getApiUrl();
  return apiUrl.replace(/\/$/, "").replace(/^http/, "ws") + "/ws/admin";
}

function readTokenExpiry(token: string): number | undefined {
  const encodedPayload = token.split(".")[1];
  if (!encodedPayload) return undefined;
  const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const payload = JSON.parse(atob(padded)) as { exp?: number };
  return payload.exp;
}

export function useAdminWS(token: string | null) {
  const wsRef = useRef<ReliableWebSocketClient | null>(null);
  const connectionVersion = useRef(0);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);

  const connect = useCallback(async () => {
    if (!token) return;
    const version = ++connectionVersion.current;
    wsRef.current?.disconnect();

    let wsToken = token;
    try {
      const expiry = readTokenExpiry(token);
      if (expiry && expiry <= Math.floor(Date.now() / 1000)) {
        if (!(await refreshAdminAccessToken())) {
          if (connectionVersion.current === version) setConnected(false);
          return;
        }
        wsToken = localStorage.getItem("admin_token") || "";
      }
    } catch {
      return;
    }
    if (connectionVersion.current !== version || !wsToken) return;

    let ws: ReliableWebSocketClient;
    ws = new ReliableWebSocketClient(() => {
      const currentToken = localStorage.getItem("admin_token") || wsToken;
      return `${getWsUrl()}?token=${encodeURIComponent(currentToken)}`;
    }, {
      onOpen: () => {
        if (connectionVersion.current === version) setConnected(true);
      },
      onClose: (event) => {
        if (connectionVersion.current === version) setConnected(false);
        if (connectionVersion.current !== version || event.code === 1000) return;
        const currentToken = localStorage.getItem("admin_token");
        if (!currentToken) return;
        try {
          const expiry = readTokenExpiry(currentToken);
          if (expiry && expiry <= Math.floor(Date.now() / 1000)) {
            void refreshAdminAccessToken().then((refreshed) => {
              if (refreshed && connectionVersion.current === version) ws.connect();
            });
          }
        } catch {
          return;
        }
      },
      onMessage: (ev) => {
        if (connectionVersion.current !== version) return;
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
      connectionVersion.current += 1;
      wsRef.current?.disconnect();
    };
  }, [connect]);

  const send = useCallback((type: string, payload?: Record<string, unknown>) => {
    wsRef.current?.sendJSON({ type, payload, ts: new Date().toISOString() });
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { connected, messages, send, clearMessages };
}
