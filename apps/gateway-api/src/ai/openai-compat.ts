/**
 * Watany AI Chat Provider — OpenAI-Compatible Implementation
 *
 * Works with any API that speaks the OpenAI chat completions format:
 *   - OpenAI (gpt-4o, gpt-4o-mini, etc.)
 *   - Azure OpenAI
 *   - Ollama (via OpenAI-compat endpoint /v1/chat/completions)
 *   - LM Studio, LocalAI, vLLM, etc.
 *
 * Supports both streaming (SSE) and non-streaming modes.
 */
import type {
  AiChatProvider,
  AiMessage,
  AiProviderConfig,
  AiStreamCallback,
} from "./types";

type OpenAiStreamChunk = {
  choices?: { delta?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

type StreamState = {
  fullText: string;
  promptTokens: number;
  completionTokens: number;
  inThinkBlock: boolean;
};

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") {
    end -= 1;
  }
  return value.slice(0, end);
}

function stripThinkBlocks(content: string): string {
  const normalized = content.toLowerCase();
  const openingTag = "<think>";
  const closingTag = "</think>";
  let cursor = 0;
  let result = "";

  while (cursor < content.length) {
    const openingIndex = normalized.indexOf(openingTag, cursor);
    if (openingIndex === -1) break;

    const closingIndex = normalized.indexOf(
      closingTag,
      openingIndex + openingTag.length,
    );
    if (closingIndex === -1) break;

    result += content.slice(cursor, openingIndex);
    cursor = closingIndex + closingTag.length;
  }

  return result + content.slice(cursor);
}

function appendStreamDelta(
  state: StreamState,
  incomingDelta: string,
  onEvent: AiStreamCallback,
): void {
  let delta = incomingDelta;
  const closingTag = "</think>";

  if (delta.includes("<think>")) state.inThinkBlock = true;
  if (state.inThinkBlock) {
    const closingIndex = delta.lastIndexOf(closingTag);
    if (closingIndex === -1) {
      delta = "";
    } else {
      delta = delta.slice(closingIndex + closingTag.length);
      state.inThinkBlock = false;
    }
  }

  delta = stripThinkBlocks(delta);
  if (!delta) return;

  state.fullText += delta;
  onEvent({ type: "delta", delta });
}

function processSseLine(
  line: string,
  state: StreamState,
  onEvent: AiStreamCallback,
): void {
  const trimmedLine = line.trim();
  if (
    !trimmedLine ||
    trimmedLine.startsWith(":") ||
    !trimmedLine.startsWith("data:")
  )
    return;

  const payload = trimmedLine.slice(5).trim();
  if (payload === "[DONE]") return;

  try {
    const chunk = JSON.parse(payload) as OpenAiStreamChunk;
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) appendStreamDelta(state, delta, onEvent);

    if (chunk.usage) {
      state.promptTokens = chunk.usage.prompt_tokens ?? state.promptTokens;
      state.completionTokens =
        chunk.usage.completion_tokens ?? state.completionTokens;
    }
  } catch {
    // Ignore malformed chunks
  }
}

async function consumeSseBody(
  body: ReadableStream<Uint8Array>,
  onEvent: AiStreamCallback,
): Promise<StreamState> {
  const state: StreamState = {
    fullText: "",
    promptTokens: 0,
    completionTokens: 0,
    inThinkBlock: false,
  };
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) processSseLine(line, state, onEvent);
  }

  return state;
}

export class OpenAiCompatProvider implements AiChatProvider {
  readonly name: string;
  private readonly cfg: AiProviderConfig;

  constructor(cfg: AiProviderConfig) {
    this.cfg = cfg;
    this.name = cfg.provider || "openai-compat";
  }

  /** GPT-5.x, o1, o3, o4 etc. require max_completion_tokens instead of max_tokens */
  private useMaxCompletionTokens(model: string): boolean {
    return /^(gpt-5|o[1-9]|o\d+-)/i.test(model);
  }

  private getReasoningFields() {
    const effort = (process.env.AI_REASONING_EFFORT || "").trim().toLowerCase();
    if (!effort || !["high", "medium", "low", "none"].includes(effort)) {
      return {};
    }

    return {
      reasoning_effort: effort,
      reasoning: { effort },
    };
  }

  private isOllama(cfg: AiProviderConfig): boolean {
    return cfg.provider.toLowerCase() === "ollama";
  }

  private ollamaBaseUrl(cfg: AiProviderConfig): string {
    return trimTrailingSlashes(cfg.baseUrl).replace(/\/v1$/i, "");
  }

  private ollamaBody(
    cfg: AiProviderConfig,
    messages: AiMessage[],
    stream: boolean,
  ) {
    return {
      model: cfg.model,
      messages,
      stream,
      think: false,
      keep_alive: process.env.AI_OLLAMA_KEEP_ALIVE || "30m",
      options: {
        num_ctx: Number(process.env.AI_OLLAMA_NUM_CTX || "8192"),
        num_predict: cfg.maxTokens ?? 500,
        temperature: cfg.temperature ?? 0.2,
        top_p: 0.9,
      },
    };
  }

  private async completeOllama(
    messages: AiMessage[],
    cfg: AiProviderConfig,
  ): Promise<string> {
    const res = await fetch(`${this.ollamaBaseUrl(cfg)}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(cfg.timeoutMs ?? 180_000),
      body: JSON.stringify(this.ollamaBody(cfg, messages, false)),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`AI provider ollama error ${res.status}: ${err}`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const content = stripThinkBlocks(data.message?.content ?? "").trim();
    if (!content) throw new Error("AI provider ollama returned empty content");
    return content;
  }

  private async streamOllama(
    messages: AiMessage[],
    onEvent: AiStreamCallback,
    cfg: AiProviderConfig,
  ): Promise<string> {
    const res = await fetch(`${this.ollamaBaseUrl(cfg)}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(cfg.timeoutMs ?? 180_000),
      body: JSON.stringify(this.ollamaBody(cfg, messages, true)),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      const msg = `AI provider ollama error ${res.status}: ${err}`;
      onEvent({ type: "error", message: msg });
      throw new Error(msg);
    }

    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullText = "";
    let promptTokens = 0;
    let completionTokens = 0;

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const chunk = JSON.parse(trimmed) as {
        message?: { content?: string };
        error?: string;
        prompt_eval_count?: number;
        eval_count?: number;
      };
      if (chunk.error) throw new Error(chunk.error);
      const delta = stripThinkBlocks(chunk.message?.content ?? "");
      if (delta) {
        fullText += delta;
        onEvent({ type: "delta", delta });
      }
      promptTokens = chunk.prompt_eval_count ?? promptTokens;
      completionTokens = chunk.eval_count ?? completionTokens;
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) handleLine(line);
    }
    if (buffer.trim()) handleLine(buffer);

    onEvent({
      type: "done",
      fullText,
      usage: { promptTokens, completionTokens },
    });
    return fullText;
  }

  /* ---------------------------------------------------------------- */
  /*  Non-streaming                                                    */
  /* ---------------------------------------------------------------- */

  async complete(
    messages: AiMessage[],
    options?: Partial<AiProviderConfig>,
  ): Promise<string> {
    const merged = { ...this.cfg, ...options };
    if (this.isOllama(merged)) return this.completeOllama(messages, merged);
    const url = `${trimTrailingSlashes(merged.baseUrl)}/chat/completions`;
    const timeoutMs = merged.timeoutMs ?? 60_000;

    const res = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(merged),
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: merged.model,
        messages,
        ...(this.useMaxCompletionTokens(merged.model)
          ? { max_completion_tokens: merged.maxTokens ?? 2048 }
          : { max_tokens: merged.maxTokens ?? 2048 }),
        temperature: merged.temperature ?? 0.3,
        stream: false,
        ...this.getReasoningFields(),
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`AI provider ${this.name} error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };

    let content = data.choices?.[0]?.message?.content ?? "";
    // DeepSeek-R1 models may include <think>...</think> reasoning in content — strip it
    content = stripThinkBlocks(content).trim();
    return content;
  }

  /* ---------------------------------------------------------------- */
  /*  Streaming                                                        */
  /* ---------------------------------------------------------------- */

  async stream(
    messages: AiMessage[],
    onEvent: AiStreamCallback,
    options?: Partial<AiProviderConfig>,
  ): Promise<string> {
    const merged = { ...this.cfg, ...options };
    if (this.isOllama(merged))
      return this.streamOllama(messages, onEvent, merged);
    const url = `${trimTrailingSlashes(merged.baseUrl)}/chat/completions`;
    const timeoutMs = merged.timeoutMs ?? 90_000;

    const res = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(merged),
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: merged.model,
        messages,
        ...(this.useMaxCompletionTokens(merged.model)
          ? { max_completion_tokens: merged.maxTokens ?? 2048 }
          : { max_tokens: merged.maxTokens ?? 2048 }),
        temperature: merged.temperature ?? 0.3,
        stream: true,
        ...this.getReasoningFields(),
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      const msg = `AI provider ${this.name} error ${res.status}: ${err}`;
      onEvent({ type: "error", message: msg });
      throw new Error(msg);
    }

    const state = await consumeSseBody(
      res.body as ReadableStream<Uint8Array>,
      onEvent,
    );

    onEvent({
      type: "done",
      fullText: state.fullText,
      usage: {
        promptTokens: state.promptTokens,
        completionTokens: state.completionTokens,
      },
    });

    return state.fullText;
  }

  /* ---------------------------------------------------------------- */
  /*  Health check                                                     */
  /* ---------------------------------------------------------------- */

  async healthCheck(): Promise<{
    ok: boolean;
    model: string;
    latencyMs: number;
  }> {
    const start = Date.now();
    try {
      const url = this.isOllama(this.cfg)
        ? `${this.ollamaBaseUrl(this.cfg)}/api/tags`
        : `${trimTrailingSlashes(this.cfg.baseUrl)}/models`;
      const res = await fetch(url, {
        method: "GET",
        headers: this.buildHeaders(this.cfg),
        signal: AbortSignal.timeout(3000),
      });
      return {
        ok: res.ok,
        model: this.cfg.model,
        latencyMs: Date.now() - start,
      };
    } catch {
      return {
        ok: false,
        model: this.cfg.model,
        latencyMs: Date.now() - start,
      };
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  private buildHeaders(cfg: AiProviderConfig): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (cfg.apiKey) {
      headers["authorization"] = `Bearer ${cfg.apiKey}`;
    }
    return headers;
  }
}
