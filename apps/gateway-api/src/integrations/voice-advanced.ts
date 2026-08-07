/**
 * Watany Advanced Voice Integration
 * 
 * Phase 5: Enhanced voice command processing
 * - Voice-to-text with advanced AI pipeline
 * - Text-to-speech with emotional synthesis
 * - Voice command detection
 * - Natural conversation flow
 * - Arabic voice optimization
 */

import { randomUUID } from 'crypto';
import { advancedChatHandler } from '../ai/advanced-chat-handler';
import { getSessionStore } from '../ai/session-tracking';
import { feedbackLoop } from '../ai/feedback-loop';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface VoiceCommand {
  id: string;
  pattern: RegExp;
  handler: (matches: RegExpMatchArray, context: VoiceContext) => Promise<VoiceResponse>;
  description: string;
  examples: string[];
}

export interface VoiceContext {
  userId?: string;
  sessionId: string;
  language: 'ar' | 'en';
  previousCommands: string[];
  userPreferences: Record<string, unknown>;
}

export interface VoiceResponse {
  text: string;
  audioUrl?: string;
  shouldListen?: boolean;  // Continue listening for follow-up
  quickActions?: Array<{ label: string; command: string }>;
  emotion?: 'neutral' | 'happy' | 'empathetic' | 'formal';
}

export interface VoiceProcessingResult {
  transcript: string;
  response: VoiceResponse;
  confidence: number;
  commandMatched?: string;
  processingTimeMs: number;
}

export interface VoiceConfig {
  sttProvider: 'openai' | 'azure' | 'google';
  ttsProvider: 'openai' | 'voicerss' | 'azure' | 'google';
  defaultLanguage: 'ar' | 'en';
  enableCommandDetection: boolean;
  maxListenDurationSec: number;
}

// ─────────────────────────────────────────────────────────────────────
// Voice Commands Registry
// ─────────────────────────────────────────────────────────────────────

export class VoiceCommandRegistry {
  private commands: Map<string, VoiceCommand> = new Map();

  constructor() {
    this.registerDefaultCommands();
  }

  /**
   * Register default Arabic voice commands
   */
  private registerDefaultCommands(): void {
    // Salary query
    this.register({
      id: 'salary_query',
      pattern: /(?:كم|ما هو|احسب|حساب)\s*(?:راتب|معاش)/i,
      handler: async (_matches, context) => {
        const result = await advancedChatHandler.handleChat({
          message: 'كيف يتم حساب الراتب التقاعدي؟',
          userId: context.userId,
          channel: 'voice',
        });

        return {
          text: result.answer,
          emotion: 'formal',
          quickActions: [
            { label: 'حاسبة الراتب', command: 'افتح حاسبة الراتب' },
            { label: '', command: 'ما هي شروط الاستحقاق' },
          ],
        };
      },
      description: 'استعلام عن الراتب',
      examples: ['كم راتبي', 'احسب معاشي', 'ما هو راتب التقاعد'],
    });

    // Eligibility check
    this.register({
      id: 'eligibility_check',
      pattern: /(?:هل|ما هي)\s*(?:أستحق|استحق|شروط|متطلبات)/i,
      handler: async (_matches, context) => {
        const result = await advancedChatHandler.handleChat({
          message: 'ما هي شروط استحقاق معاش المحارب القديم؟',
          userId: context.userId,
          channel: 'voice',
        });

        return {
          text: result.answer,
          emotion: 'empathetic',
          shouldListen: true,
        };
      },
      description: 'التحقق من الاستحقاق',
      examples: ['هل أستحق معاش', 'ما هي شروط الاستحقاق'],
    });

    // Help command
    this.register({
      id: 'help',
      pattern: /(?:مساعدة|ساعدني|ماذا يمكنك|ما الذي تفعله)/i,
      handler: async () => ({
        text: `أنا مساعدك الصوتي للمحاربين القدامى. يمكنك أن تسألني عن:
الرواتب والمعاشات،
شروط الاستحقاق،
الإجراءات المطلوبة،
أو أي استفسار آخر متعلق بخدمات المحاربين القدامى.
كيف يمكنني مساعدتك؟`,
        emotion: 'happy',
        shouldListen: true,
        quickActions: [
          { label: 'راتبي', command: 'كم راتبي' },
          { label: 'الاستحقاق', command: 'هل أستحق معاش' },
        ],
      }),
      description: 'طلب المساعدة',
      examples: ['مساعدة', 'ساعدني'],
    });

    // Navigation commands
    this.register({
      id: 'navigate',
      pattern: /(?:افتح|اذهب إلى|انتقل إلى)\s*(.*)/i,
      handler: async (matches) => {
        const destination = matches[1]?.trim() || '';
        const pageMap: Record<string, string> = {
          'الرئيسية': '/',
          'المحادثة': '/chat',
          'حاسبة الراتب': '/salary',
          'البحث': '/search',
          'الملف الشخصي': '/profile',
          'الإعدادات': '/settings',
        };

        const path = pageMap[destination];
        if (path) {
          return {
            text: `جارٍ الانتقال إلى ${destination}`,
            emotion: 'neutral',
          };
        }

        return {
          text: `لم أتمكن من العثور على صفحة "${destination}". يمكنك الانتقال إلى: الرئيسية، المحادثة، حاسبة الراتب، البحث، أو الإعدادات.`,
          emotion: 'empathetic',
          shouldListen: true,
        };
      },
      description: 'التنقل بين الصفحات',
      examples: ['افتح حاسبة الراتب', 'اذهب إلى الإعدادات'],
    });

    // Stop command
    this.register({
      id: 'stop',
      pattern: /(?:توقف|أوقف|كفى|إنهاء)/i,
      handler: async () => ({
        text: 'حسناً، أنا هنا عندما تحتاجني.',
        emotion: 'neutral',
        shouldListen: false,
      }),
      description: 'إيقاف الاستماع',
      examples: ['توقف', 'أوقف الاستماع'],
    });
  }

  /**
   * Register a voice command
   */
  register(command: VoiceCommand): void {
    this.commands.set(command.id, command);
  }

  /**
   * Find matching command
   */
  findCommand(text: string): { command: VoiceCommand; matches: RegExpMatchArray } | null {
    for (const command of this.commands.values()) {
      const matches = text.match(command.pattern);
      if (matches) {
        return { command, matches };
      }
    }
    return null;
  }

  /**
   * Get all commands
   */
  getCommands(): VoiceCommand[] {
    return Array.from(this.commands.values());
  }
}

// ─────────────────────────────────────────────────────────────────────
// Voice Processor
// ─────────────────────────────────────────────────────────────────────

export class VoiceProcessor {
  private commandRegistry: VoiceCommandRegistry;
  private config: VoiceConfig;

  constructor(config?: Partial<VoiceConfig>) {
    this.commandRegistry = new VoiceCommandRegistry();
    this.config = {
      sttProvider: config?.sttProvider || 'openai',
      ttsProvider: config?.ttsProvider || 'voicerss',
      defaultLanguage: config?.defaultLanguage || 'ar',
      enableCommandDetection: config?.enableCommandDetection ?? true,
      maxListenDurationSec: config?.maxListenDurationSec || 30,
    };
  }

  /**
   * Process voice input (transcript → AI → response)
   */
  async process(
    transcript: string,
    userId?: string,
    sessionId?: string
  ): Promise<VoiceProcessingResult> {
    const startTime = Date.now();

    // Get or create session
    const sessionStore = getSessionStore();
    const session = sessionId 
      ? sessionStore.get(sessionId) || sessionStore.create(userId, 'api')
      : sessionStore.create(userId, 'api');

    const context: VoiceContext = {
      userId,
      sessionId: session.id,
      language: this.config.defaultLanguage,
      previousCommands: [],
      userPreferences: {},
    };

    let response: VoiceResponse;
    let commandMatched: string | undefined;

    // Try to match a voice command first
    if (this.config.enableCommandDetection) {
      const match = this.commandRegistry.findCommand(transcript);
      
      if (match) {
        commandMatched = match.command.id;
        response = await match.command.handler(match.matches, context);
      } else {
        // Fall back to general AI processing
        response = await this.processWithAI(transcript, context);
      }
    } else {
      response = await this.processWithAI(transcript, context);
    }

    const processingTime = Date.now() - startTime;

    // Record interaction
    feedbackLoop.storeInteraction({
      userId: userId || 'anonymous',
      query: transcript,
      understanding: {},
      answer: response.text,
      confidence: commandMatched ? 1.0 : 0.8,
      sources: [],
      responseTimeMs: processingTime,
      channel: 'voice' as const,
    });

    return {
      transcript,
      response,
      confidence: commandMatched ? 1.0 : 0.8,
      commandMatched,
      processingTimeMs: processingTime,
    };
  }

  /**
   * Process with AI pipeline
   */
  private async processWithAI(transcript: string, context: VoiceContext): Promise<VoiceResponse> {
    try {
      const result = await advancedChatHandler.handleChat({
        message: transcript,
        userId: context.userId,
        channel: 'voice',
      });

      // Determine emotion based on content
      let emotion: VoiceResponse['emotion'] = 'neutral';
      if (result.confidence.score < 0.5) {
        emotion = 'empathetic';
      } else if (result.answer.includes('مبروك') || result.answer.includes('تهانينا')) {
        emotion = 'happy';
      }

      // Build quick actions from suggestions
      const quickActions = result.suggestedFollowups?.slice(0, 2).map((s: string) => ({
        label: s.slice(0, 20),
        command: s,
      }));

      return {
        text: result.answer,
        emotion,
        shouldListen: result.confidenceLevel === 'low' || result.confidenceLevel === 'very_low',
        quickActions,
      };
    } catch (error) {
      console.error('[VOICE] AI processing error:', error);
      return {
        text: 'عذراً، لم أتمكن من فهم طلبك. هل يمكنك إعادة صياغة السؤال؟',
        emotion: 'empathetic',
        shouldListen: true,
      };
    }
  }

  /**
   * Register custom voice command
   */
  registerCommand(command: VoiceCommand): void {
    this.commandRegistry.register(command);
  }

  /**
   * Get available commands
   */
  getAvailableCommands(): Array<{ id: string; description: string; examples: string[] }> {
    return this.commandRegistry.getCommands().map(cmd => ({
      id: cmd.id,
      description: cmd.description,
      examples: cmd.examples,
    }));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Voice API Routes
// ─────────────────────────────────────────────────────────────────────

export async function voiceAdvancedRoutes(app: FastifyInstance): Promise<void> {
  const processor = getVoiceProcessor();

  /**
   * POST /api/voice/process
   * Process voice transcript with AI
   */
  app.post('/api/voice/process', async (
    request: FastifyRequest<{
      Body: {
        transcript: string;
        userId?: string;
        sessionId?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { transcript, userId, sessionId } = request.body;

    if (!transcript || typeof transcript !== 'string') {
      return reply.status(400).send({
        success: false,
        error: 'transcript is required',
      });
    }

    try {
      const result = await processor.process(transcript, userId, sessionId);

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[VOICE] Processing error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Voice processing failed',
      });
    }
  });

  /**
   * GET /api/voice/commands
   * Get available voice commands
   */
  app.get('/api/voice/commands', async (_request: FastifyRequest, reply: FastifyReply) => {
    const commands = processor.getAvailableCommands();

    return reply.send({
      success: true,
      data: {
        commands,
        language: 'ar',
      },
    });
  });

  /**
   * POST /api/voice/conversation
   * Handle full voice conversation turn
   */
  app.post('/api/voice/conversation', async (
    request: FastifyRequest<{
      Body: {
        audio?: string;  // base64 audio for STT
        transcript?: string;  // or direct transcript
        userId?: string;
        sessionId?: string;
        generateAudio?: boolean;  // whether to generate TTS
      };
    }>,
    reply: FastifyReply
  ) => {
    const { audio, transcript, userId, sessionId, generateAudio = false } = request.body;

    if (!audio && !transcript) {
      return reply.status(400).send({
        success: false,
        error: 'Either audio or transcript is required',
      });
    }

    let inputText = transcript || '';

    // If audio provided, would call STT here
    // For now, require transcript
    if (audio && !transcript) {
      // TODO: Call existing /api/stt endpoint
      return reply.status(400).send({
        success: false,
        error: 'Please provide transcript. Audio-only not supported in this endpoint.',
      });
    }

    try {
      const result = await processor.process(inputText, userId, sessionId);

      const response: Record<string, unknown> = {
        success: true,
        data: {
          ...result,
        },
      };

      // TODO: If generateAudio, call TTS and include audioUrl

      return reply.send(response);
    } catch (error) {
      console.error('[VOICE] Conversation error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Voice conversation failed',
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────
// Factory and Singleton
// ─────────────────────────────────────────────────────────────────────

let voiceProcessorInstance: VoiceProcessor | null = null;

export function getVoiceProcessor(): VoiceProcessor {
  if (!voiceProcessorInstance) {
    voiceProcessorInstance = new VoiceProcessor({
      sttProvider: process.env.STT_PROVIDER as 'openai' | 'azure' | 'google' || 'openai',
      ttsProvider: process.env.TTS_PROVIDER as 'openai' | 'voicerss' | 'azure' | 'google' || 'voicerss',
      defaultLanguage: 'ar',
      enableCommandDetection: process.env.VOICE_COMMAND_DETECTION !== 'false',
      maxListenDurationSec: parseInt(process.env.VOICE_MAX_LISTEN_SEC || '30'),
    });
  }
  return voiceProcessorInstance;
}

export function createVoiceProcessor(config: Partial<VoiceConfig>): VoiceProcessor {
  voiceProcessorInstance = new VoiceProcessor(config);
  return voiceProcessorInstance;
}
