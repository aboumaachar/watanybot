type ReliableWebSocketState = "idle" | "connecting" | "open" | "reconnecting" | "closed";

type ReliableWebSocketOptions = {
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  reconnectBackoffFactor?: number;
  maxQueueSize?: number;
  shouldReconnect?: (event: CloseEvent) => boolean;
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onStateChange?: (state: ReliableWebSocketState) => void;
  heartbeatPayload?: () => unknown;
};

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 45_000;
const DEFAULT_INITIAL_RECONNECT_DELAY_MS = 1_000;
const DEFAULT_MAX_RECONNECT_DELAY_MS = 15_000;
const DEFAULT_RECONNECT_BACKOFF_FACTOR = 1.8;
const DEFAULT_MAX_QUEUE_SIZE = 100;
const NORMAL_CLOSURE_CODE = 1000;

export type { ReliableWebSocketOptions, ReliableWebSocketState };

export class ReliableWebSocketClient {
  private socket: WebSocket | null = null;
  private readonly urlFactory: string | (() => string);
  private readonly options: Required<
    Pick<
      ReliableWebSocketOptions,
      | "heartbeatIntervalMs"
      | "heartbeatTimeoutMs"
      | "initialReconnectDelayMs"
      | "maxReconnectDelayMs"
      | "reconnectBackoffFactor"
      | "maxQueueSize"
    >
  > & Omit<ReliableWebSocketOptions, "heartbeatIntervalMs" | "heartbeatTimeoutMs" | "initialReconnectDelayMs" | "maxReconnectDelayMs" | "reconnectBackoffFactor" | "maxQueueSize">;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private lastActivityAt = 0;
  private closedManually = false;
  private queuedMessages: string[] = [];
  private state: ReliableWebSocketState = "idle";

  constructor(urlFactory: string | (() => string), options: ReliableWebSocketOptions = {}) {
    this.urlFactory = urlFactory;
    this.options = {
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS,
      heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS,
      initialReconnectDelayMs: options.initialReconnectDelayMs ?? DEFAULT_INITIAL_RECONNECT_DELAY_MS,
      maxReconnectDelayMs: options.maxReconnectDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS,
      reconnectBackoffFactor: options.reconnectBackoffFactor ?? DEFAULT_RECONNECT_BACKOFF_FACTOR,
      maxQueueSize: options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE,
      shouldReconnect: options.shouldReconnect,
      onOpen: options.onOpen,
      onMessage: options.onMessage,
      onError: options.onError,
      onClose: options.onClose,
      onStateChange: options.onStateChange,
      heartbeatPayload: options.heartbeatPayload,
    };
  }

  connect() {
    this.closedManually = false;
    this.clearReconnectTimer();

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const nextState = this.reconnectAttempts > 0 ? "reconnecting" : "connecting";
    this.setState(nextState);

    const socket = new WebSocket(this.resolveUrl());
    this.socket = socket;

    socket.onopen = (event) => {
      this.reconnectAttempts = 0;
      this.lastActivityAt = Date.now();
      this.setState("open");
      this.flushQueue();
      this.startHeartbeat();
      this.options.onOpen?.(event);
    };

    socket.onmessage = (event) => {
      this.lastActivityAt = Date.now();
      if (this.isHeartbeatAck(event.data)) {
        return;
      }

      this.options.onMessage?.(event);
    };

    socket.onerror = (event) => {
      this.options.onError?.(event);
    };

    socket.onclose = (event) => {
      if (this.socket === socket) {
        this.socket = null;
      }

      this.stopHeartbeat();
      this.options.onClose?.(event);

      if (this.closedManually) {
        this.setState("closed");
        return;
      }

      const shouldReconnect = this.options.shouldReconnect?.(event) ?? event.code !== NORMAL_CLOSURE_CODE;
      if (!shouldReconnect) {
        this.setState("closed");
        return;
      }

      this.scheduleReconnect();
    };
  }

  disconnect(code = NORMAL_CLOSURE_CODE, reason?: string) {
    this.closedManually = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();

    const socket = this.socket;
    this.socket = null;
    this.setState("closed");

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close(code, reason);
      return;
    }

    socket?.close();
  }

  send(data: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(data);
      return true;
    }

    this.queueMessage(data);
    if (!this.socket) {
      this.connect();
    }
    return false;
  }

  sendJSON(payload: unknown) {
    return this.send(JSON.stringify(payload));
  }

  isOpen() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  getState() {
    return this.state;
  }

  private resolveUrl() {
    return typeof this.urlFactory === "function" ? this.urlFactory() : this.urlFactory;
  }

  private setState(state: ReliableWebSocketState) {
    if (this.state === state) {
      return;
    }

    this.state = state;
    this.options.onStateChange?.(state);
  }

  private flushQueue() {
    if (this.queuedMessages.length === 0 || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const queued = [...this.queuedMessages];
    this.queuedMessages = [];
    for (const message of queued) {
      this.socket.send(message);
    }
  }

  private queueMessage(data: string) {
    this.queuedMessages.push(data);
    if (this.queuedMessages.length > this.options.maxQueueSize) {
      this.queuedMessages.splice(0, this.queuedMessages.length - this.options.maxQueueSize);
    }
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();
    this.reconnectAttempts += 1;
    this.setState("reconnecting");

    const delay = Math.min(
      this.options.initialReconnectDelayMs * this.options.reconnectBackoffFactor ** Math.max(this.reconnectAttempts - 1, 0),
      this.options.maxReconnectDelayMs,
    );

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer === null) {
      return;
    }

    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.lastActivityAt = Date.now();
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }

      if (Date.now() - this.lastActivityAt > this.options.heartbeatTimeoutMs) {
        this.socket.close();
        return;
      }

      this.socket.send(JSON.stringify(this.options.heartbeatPayload?.() ?? { type: "ping", timestamp: Date.now() }));
    }, this.options.heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer === null) {
      return;
    }

    window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private isHeartbeatAck(data: unknown) {
    if (typeof data !== "string") {
      return false;
    }

    try {
      const payload = JSON.parse(data) as { type?: string };
      return payload.type === "pong";
    } catch {
      return false;
    }
  }
}