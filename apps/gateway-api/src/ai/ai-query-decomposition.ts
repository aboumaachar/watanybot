/**
 * Watany AI Query Decomposition Engine
 * 
 * Phase 2: LLM-powered intelligent query decomposition
 * - Complex query breakdown into sub-questions
 * - Dependency graph for sub-questions
 * - Parallel and sequential execution planning
 * - Answer synthesis with LLM
 */

import type { QueryUnderstanding } from './query-understanding';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface SubQuestion {
  id: string;
  question: string;
  type: 'definition' | 'calculation' | 'comparison' | 'procedure' | 'condition' | 'temporal' | 'factual';
  dependsOn: string[];
  priority: number;
  context?: string;
}

export interface DecompositionPlan {
  originalQuery: string;
  subQuestions: SubQuestion[];
  executionOrder: string[][];  // Arrays of IDs that can run in parallel
  estimatedComplexity: number;
  decompositionMethod: 'llm' | 'rule-based' | 'hybrid';
}

export interface SubQuestionResult {
  questionId: string;
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
}

export interface SynthesizedAnswer {
  finalAnswer: string;
  confidence: number;
  subResults: SubQuestionResult[];
  synthesisMethod: 'llm' | 'template' | 'concatenation';
}

export interface LLMConfig {
  provider: 'openai' | 'ollama' | 'azure' | 'custom';
  model: string;
  baseUrl?: string;
  apiKey?: string;
  maxTokens: number;
  temperature: number;
}

// ─────────────────────────────────────────────────────────────────────
// LLM Interface
// ─────────────────────────────────────────────────────────────────────

export interface LLMProvider {
  complete(prompt: string, systemPrompt?: string): Promise<string>;
  chat(messages: Array<{ role: string; content: string }>): Promise<string>;
}

// ─────────────────────────────────────────────────────────────────────
// OpenAI-Compatible LLM Provider
// ─────────────────────────────────────────────────────────────────────

export class OpenAILLMProvider implements LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const messages = [
      { role: 'system', content: systemPrompt || 'أنت مساعد ذكي متخصص في شؤون المحاربين القدامى الكويتيين.' },
      { role: 'user', content: prompt },
    ];
    return this.chat(messages);
  }

  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Ollama LLM Provider
// ─────────────────────────────────────────────────────────────────────

export class OllamaLLMProvider implements LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const baseUrl = this.config.baseUrl || 'http://localhost:11434';

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        system: systemPrompt || 'أنت مساعد ذكي متخصص في شؤون المحاربين القدامى الكويتيين.',
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const baseUrl = this.config.baseUrl || 'http://localhost:11434';

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Rule-Based Decomposition (Fallback)
// ─────────────────────────────────────────────────────────────────────

function ruleBasedDecomposition(query: string, understanding: QueryUnderstanding): SubQuestion[] {
  const subQuestions: SubQuestion[] = [];
  let questionId = 1;

  // Multi-clause detection
  const clauses = query.split(/[،,؟?]/);

  if (clauses.length > 1) {
    for (const clause of clauses) {
      const trimmed = clause.trim();
      if (trimmed.length > 5) {
        subQuestions.push({
          id: `sq_${questionId++}`,
          question: trimmed,
          type: 'factual',
          dependsOn: [],
          priority: questionId,
        });
      }
    }
  }

  // Condition detection
  if (query.includes('إذا') || query.includes('في حال') || query.includes('شرط')) {
    subQuestions.push({
      id: `sq_${questionId++}`,
      question: 'ما هي  المطلوبة؟',
      type: 'condition',
      dependsOn: [],
      priority: 1,
    });
  }

  // Procedure detection
  if (query.includes('كيف') || query.includes('خطوات') || query.includes('إجراءات')) {
    subQuestions.push({
      id: `sq_${questionId++}`,
      question: 'ما هي الخطوات أو الإجراءات المطلوبة؟',
      type: 'procedure',
      dependsOn: [],
      priority: 2,
    });
  }

  // Calculation detection
  if (query.includes('كم') || query.includes('حساب') || query.includes('مبلغ') || query.includes('راتب')) {
    subQuestions.push({
      id: `sq_${questionId++}`,
      question: 'ما هي طريقة الحساب والمبالغ؟',
      type: 'calculation',
      dependsOn: [],
      priority: 2,
    });
  }

  // Time-related
  if (understanding.temporalContext?.hasTemporal) {
    subQuestions.push({
      id: `sq_${questionId++}`,
      question: 'ما هي المدة الزمنية أو الفترة المحددة؟',
      type: 'temporal',
      dependsOn: [],
      priority: 1,
    });
  }

  // Comparison
  if (query.includes('مقارنة') || query.includes('الفرق') || query.includes('أفضل')) {
    subQuestions.push({
      id: `sq_${questionId++}`,
      question: 'ما هي عناصر المقارنة؟',
      type: 'comparison',
      dependsOn: [],
      priority: 2,
    });
  }

  // If no sub-questions generated, create one from original
  if (subQuestions.length === 0) {
    subQuestions.push({
      id: 'sq_1',
      question: query,
      type: 'factual',
      dependsOn: [],
      priority: 1,
    });
  }

  return subQuestions;
}

// ─────────────────────────────────────────────────────────────────────
// AI Query Decomposition Engine
// ─────────────────────────────────────────────────────────────────────

export class AIQueryDecomposer {
  private llmProvider: LLMProvider | null;
  private useLLM: boolean;

  constructor(llmConfig?: LLMConfig) {
    if (llmConfig) {
      switch (llmConfig.provider) {
        case 'ollama':
          this.llmProvider = new OllamaLLMProvider(llmConfig);
          break;
        case 'openai':
        case 'azure':
        case 'custom':
          this.llmProvider = new OpenAILLMProvider(llmConfig);
          break;
        default:
          this.llmProvider = null;
      }
      this.useLLM = true;
    } else {
      this.llmProvider = null;
      this.useLLM = false;
    }
  }

  /**
   * Decompose complex query into sub-questions
   */
  async decompose(query: string, understanding: QueryUnderstanding): Promise<DecompositionPlan> {
    // Simple queries don't need decomposition
    if (understanding.complexity === 'simple') {
      return {
        originalQuery: query,
        subQuestions: [{
          id: 'sq_1',
          question: query,
          type: 'factual',
          dependsOn: [],
          priority: 1,
        }],
        executionOrder: [['sq_1']],
        estimatedComplexity: 1,
        decompositionMethod: 'rule-based',
      };
    }

    // Try LLM decomposition first
    if (this.useLLM && this.llmProvider) {
      try {
        return await this.llmDecompose(query, understanding);
      } catch {
        // Fall back to rule-based
        console.warn('LLM decomposition failed, falling back to rule-based');
      }
    }

    // Rule-based decomposition
    const subQuestions = ruleBasedDecomposition(query, understanding);
    const executionOrder = this.buildExecutionOrder(subQuestions);

    return {
      originalQuery: query,
      subQuestions,
      executionOrder,
      estimatedComplexity: subQuestions.length,
      decompositionMethod: 'rule-based',
    };
  }

  /**
   * LLM-powered decomposition
   */
  private async llmDecompose(query: string, understanding: QueryUnderstanding): Promise<DecompositionPlan> {
    const prompt = `
أنت محلل أسئلة متخصص. قم بتحليل السؤال التالي وتفكيكه إلى أسئلة فرعية.

السؤال الأصلي: "${query}"

نوع النية: ${understanding.primaryIntent}
التعقيد: ${understanding.complexity}
الكيانات المستخرجة: ${JSON.stringify(understanding.entities)}

قم بإرجاع JSON بالشكل التالي:
{
  "subQuestions": [
    {
      "id": "sq_1",
      "question": "السؤال الفرعي",
      "type": "definition|calculation|comparison|procedure|condition|temporal|factual",
      "dependsOn": [],
      "priority": 1
    }
  ]
}

قواعد:
1. كل سؤال فرعي يجب أن يكون مستقلاً قدر الإمكان
2. حدد التبعيات بين الأسئلة إذا وجدت
3. رتب الأولويات حسب منطق الإجابة
4. لا تزيد عن 5 أسئلة فرعية

أعد JSON فقط بدون أي نص إضافي.
`;

    const response = await this.llmProvider!.complete(prompt);
    
    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const subQuestions: SubQuestion[] = parsed.subQuestions || [];

    // Validate and fix IDs
    subQuestions.forEach((sq, idx) => {
      if (!sq.id) sq.id = `sq_${idx + 1}`;
      if (!sq.dependsOn) sq.dependsOn = [];
      if (!sq.priority) sq.priority = idx + 1;
      if (!sq.type) sq.type = 'factual';
    });

    const executionOrder = this.buildExecutionOrder(subQuestions);

    return {
      originalQuery: query,
      subQuestions,
      executionOrder,
      estimatedComplexity: subQuestions.length,
      decompositionMethod: 'llm',
    };
  }

  /**
   * Build execution order respecting dependencies
   */
  private buildExecutionOrder(subQuestions: SubQuestion[]): string[][] {
    const order: string[][] = [];
    const completed = new Set<string>();
    const pending = [...subQuestions];

    while (pending.length > 0) {
      const parallelBatch: string[] = [];

      for (let i = pending.length - 1; i >= 0; i--) {
        const sq = pending[i];
        const depsComplete = sq.dependsOn.every(dep => completed.has(dep));
        
        if (depsComplete) {
          parallelBatch.push(sq.id);
          pending.splice(i, 1);
        }
      }

      if (parallelBatch.length === 0) {
        // Circular dependency or error - just add remaining
        order.push(pending.map(sq => sq.id));
        break;
      }

      // Sort by priority within batch
      parallelBatch.sort((a, b) => {
        const sqA = subQuestions.find(sq => sq.id === a);
        const sqB = subQuestions.find(sq => sq.id === b);
        return (sqA?.priority || 0) - (sqB?.priority || 0);
      });

      order.push(parallelBatch);
      for (const id of parallelBatch) {
        completed.add(id);
      }
    }

    return order;
  }

  /**
   * Synthesize final answer from sub-question results
   */
  async synthesize(
    originalQuery: string,
    plan: DecompositionPlan,
    subResults: SubQuestionResult[]
  ): Promise<SynthesizedAnswer> {
    // If only one sub-question, return directly
    if (subResults.length === 1) {
      return {
        finalAnswer: subResults[0].answer,
        confidence: subResults[0].confidence,
        subResults,
        synthesisMethod: 'template',
      };
    }

    // Try LLM synthesis
    if (this.useLLM && this.llmProvider) {
      try {
        return await this.llmSynthesize(originalQuery, plan, subResults);
      } catch {
        console.warn('LLM synthesis failed, falling back to template');
      }
    }

    // Template-based synthesis
    return this.templateSynthesize(originalQuery, subResults);
  }

  /**
   * LLM-powered synthesis
   */
  private async llmSynthesize(
    originalQuery: string,
    _plan: DecompositionPlan,
    subResults: SubQuestionResult[]
  ): Promise<SynthesizedAnswer> {
    const resultsText = subResults.map(r => 
      `سؤال: ${r.question}\nإجابة: ${r.answer}`
    ).join('\n\n');

    const prompt = `
السؤال الأصلي: "${originalQuery}"

الأسئلة الفرعية وإجاباتها:
${resultsText}

قم بتجميع هذه الإجابات في إجابة واحدة متكاملة ومترابطة.
اجعل الإجابة طبيعية وسلسة كأنها مكتوبة مباشرة، وليست مجرد دمج للإجابات.

الإجابة المتكاملة:
`;

    const finalAnswer = await this.llmProvider!.complete(prompt);
    const avgConfidence = subResults.reduce((sum, r) => sum + r.confidence, 0) / subResults.length;

    return {
      finalAnswer: finalAnswer.trim(),
      confidence: avgConfidence,
      subResults,
      synthesisMethod: 'llm',
    };
  }

  /**
   * Template-based synthesis
   */
  private templateSynthesize(
    _originalQuery: string,
    subResults: SubQuestionResult[]
  ): SynthesizedAnswer {
    // Build combined answer with transitions
    const transitions = ['', 'بالإضافة إلى ذلك، ', 'كما أن ', 'من المهم أيضاً أن ', 'وأخيراً، '];
    
    const parts = subResults.map((r, idx) => {
      const transition = idx < transitions.length ? transitions[idx] : '';
      return `${transition}${r.answer}`;
    });

    const finalAnswer = parts.join('\n\n');
    const avgConfidence = subResults.reduce((sum, r) => sum + r.confidence, 0) / subResults.length;

    return {
      finalAnswer,
      confidence: avgConfidence,
      subResults,
      synthesisMethod: 'concatenation',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Factory and Singleton
// ─────────────────────────────────────────────────────────────────────

let decomposerInstance: AIQueryDecomposer | null = null;

export function getAIQueryDecomposer(): AIQueryDecomposer {
  if (!decomposerInstance) {
    // Check for environment config
    const provider = process.env.LLM_PROVIDER as LLMConfig['provider'] | undefined;
    
    if (provider) {
      decomposerInstance = new AIQueryDecomposer({
        provider,
        model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
        baseUrl: process.env.LLM_BASE_URL,
        apiKey: process.env.LLM_API_KEY,
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '1000'),
        temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.3'),
      });
    } else {
      // Rule-based only
      decomposerInstance = new AIQueryDecomposer();
    }
  }
  return decomposerInstance;
}

export function createAIQueryDecomposer(config: LLMConfig): AIQueryDecomposer {
  decomposerInstance = new AIQueryDecomposer(config);
  return decomposerInstance;
}
