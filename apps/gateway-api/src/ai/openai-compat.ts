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
  AiStreamEvent,
} from "./types";

export class OpenAiCompatProvider implements AiChatProvider {
  readonly name: string;
  private cfg: AiProviderConfig;

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
    return cfg.baseUrl.replace(/\/+$/, "").replace(/\/v1$/i, "");
  }

  private ollamaBody(cfg: AiProviderConfig, messages: AiMessage[], stream: boolean) {
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

  private async completeOllama(messages: AiMessage[], cfg: AiProviderConfig): Promise<string> {
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
    const content = (data.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
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
      const delta = (chunk.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "");
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
    onEvent({ type: "done", fullText, usage: { promptTokens, completionTokens } });
    return fullText;
  }

  /* ---------------------------------------------------------------- */
  /*  Non-streaming                                                    */
  /* ---------------------------------------------------------------- */

  async complete(messages: AiMessage[], options?: Partial<AiProviderConfig>): Promise<string> {
    const merged = { ...this.cfg, ...options };
    if (this.isOllama(merged)) return this.completeOllama(messages, merged);
    const url = `${merged.baseUrl.replace(/\/+$/, "")}/chat/completions`;
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
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
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
    if (this.isOllama(merged)) return this.streamOllama(messages, onEvent, merged);
    const url = `${merged.baseUrl.replace(/\/+$/, "")}/chat/completions`;
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

    let fullText = "";
    let promptTokens = 0;
    let completionTokens = 0;
    let inThinkBlock = false;  // Track <think> blocks in streaming to suppress reasoning tokens

    // Parse SSE from the response body
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n");
      buffer = parts.pop() || "";

      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;
        if (!trimmed.startsWith("data:")) continue;

        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;

        try {
          const chunk = JSON.parse(payload) as {
            choices?: { delta?: { content?: string }; finish_reason?: string }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };

          let delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            // Suppress <think>...</think> reasoning blocks from DeepSeek-R1 streaming
            if (delta.includes("<think>")) inThinkBlock = true;
            if (inThinkBlock) {
              if (delta.includes("</think>")) {
                delta = delta.split("</think>").pop() || "";
                inThinkBlock = false;
              } else {
                delta = "";
              }
            }
            // Strip any residual think tags that arrive in a single chunk
            delta = delta.replace(/<think>[\s\S]*?<\/think>/gi, "");
            if (delta) {
              fullText += delta;
              onEvent({ type: "delta", delta });
            }
          }

          if (chunk.usage) {
            promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
            completionTokens = chunk.usage.completion_tokens ?? completionTokens;
          }
        } catch {
          // Ignore malformed chunks
        }
      }
    }

    onEvent({
      type: "done",
      fullText,
      usage: { promptTokens, completionTokens },
    });

    return fullText;
  }

  /* ---------------------------------------------------------------- */
  /*  Health check                                                     */
  /* ---------------------------------------------------------------- */

  async healthCheck(): Promise<{ ok: boolean; model: string; latencyMs: number }> {
    const start = Date.now();
    try {
      const url = this.isOllama(this.cfg)
        ? `${this.ollamaBaseUrl(this.cfg)}/api/tags`
        : `${this.cfg.baseUrl.replace(/\/+$/, "")}/models`;
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
