/**
 * Watany WhatsApp Integration
 * 
 * Phase 5: Advanced WhatsApp channel support
 * - Message handling with advanced AI pipeline
 * - Session management across conversations
 * - Rich message formatting
 * - Quick replies and interactive buttons
 * - Media handling
 */

import { randomUUID } from 'crypto';
import { advancedChatHandler } from '../ai/advanced-chat-handler';
import { getSessionStore } from '../ai/session-tracking';
import { feedbackLoop } from '../ai/feedback-loop';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  timestamp: Date;
  type: 'text' | 'image' | 'audio' | 'document' | 'location' | 'button_reply' | 'list_reply';
  text?: string;
  mediaUrl?: string;
  caption?: string;
  buttonPayload?: string;
  listPayload?: string;
  location?: { latitude: number; longitude: number };
}

export interface WhatsAppResponse {
  to: string;
  type: 'text' | 'buttons' | 'list' | 'image' | 'document';
  text?: string;
  buttons?: WhatsAppButton[];
  list?: WhatsAppList;
  mediaUrl?: string;
  caption?: string;
}

export interface WhatsAppButton {
  id: string;
  title: string;
}

export interface WhatsAppList {
  buttonText: string;
  sections: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
}

export interface WhatsAppConfig {
  apiUrl: string;
  apiToken: string;
  phoneNumberId: string;
  webhookVerifyToken?: string;
  sessionTimeoutMs?: number;
  enableProactiveMessages?: boolean;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          button?: { payload: string; text: string };
          interactive?: { type: string; [key: string]: unknown };
        }>;
        statuses?: Array<{ id: string; status: string; timestamp: string }>;
      };
      field: string;
    }>;
  }>;
}

// ─────────────────────────────────────────────────────────────────────
// WhatsApp Client
// ─────────────────────────────────────────────────────────────────────

export class WhatsAppClient {
  private config: WhatsAppConfig;
  private sessionMap: Map<string, string> = new Map(); // phone -> sessionId

  constructor(config: WhatsAppConfig) {
    this.config = config;
  }

  /**
   * Send text message
   */
  async sendText(to: string, text: string): Promise<boolean> {
    return this.sendMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    });
  }

  /**
   * Send message with buttons
   */
  async sendButtons(to: string, bodyText: string, buttons: WhatsAppButton[]): Promise<boolean> {
    // WhatsApp allows max 3 buttons
    const limitedButtons = buttons.slice(0, 3).map(b => ({
      type: 'reply',
      reply: { id: b.id, title: b.title.slice(0, 20) },
    }));

    return this.sendMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: { buttons: limitedButtons },
      },
    });
  }

  /**
   * Send list message
   */
  async sendList(to: string, bodyText: string, list: WhatsAppList): Promise<boolean> {
    return this.sendMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: list.buttonText,
          sections: list.sections,
        },
      },
    });
  }

  /**
   * Send document
   */
  async sendDocument(to: string, url: string, caption?: string, filename?: string): Promise<boolean> {
    return this.sendMessage({
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: {
        link: url,
        caption: caption || '',
        filename: filename || 'document.pdf',
      },
    });
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<boolean> {
    return this.sendMessage({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  /**
   * Send generic message via API
   */
  private async sendMessage(payload: Record<string, unknown>): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiToken}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('[WA] Send failed:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[WA] Send error:', error);
      return false;
    }
  }

  /**
   * Get or create session for phone number
   */
  getSession(phoneNumber: string): string {
    let sessionId = this.sessionMap.get(phoneNumber);
    
    if (!sessionId) {
      const sessionStore = getSessionStore();
      const session = sessionStore.create(phoneNumber, 'whatsapp');
      sessionId = session.id;
      this.sessionMap.set(phoneNumber, sessionId);
    }

    return sessionId;
  }

  /**
   * Clear session for phone number
   */
  clearSession(phoneNumber: string): void {
    const sessionId = this.sessionMap.get(phoneNumber);
    if (sessionId) {
      const sessionStore = getSessionStore();
      sessionStore.complete(sessionId);
      this.sessionMap.delete(phoneNumber);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// WhatsApp Message Handler
// ─────────────────────────────────────────────────────────────────────

export class WhatsAppHandler {
  private client: WhatsAppClient;

  constructor(client: WhatsAppClient) {
    this.client = client;
  }

  /**
   * Handle incoming webhook payload
   */
  async handleWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    if (payload.object !== 'whatsapp_business_account') return;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        // Handle messages
        if (value.messages) {
          for (const msg of value.messages) {
            await this.handleMessage({
              id: msg.id,
              from: msg.from,
              to: value.metadata.phone_number_id,
              timestamp: new Date(parseInt(msg.timestamp) * 1000),
              type: msg.type as WhatsAppMessage['type'],
              text: msg.text?.body,
              buttonPayload: msg.button?.payload,
            });
          }
        }

        // Handle status updates (optional)
        if (value.statuses) {
          for (const status of value.statuses) {
            console.log(`[WA] Message ${status.id} status: ${status.status}`);
          }
        }
      }
    }
  }

  /**
   * Handle individual message
   */
  async handleMessage(message: WhatsAppMessage): Promise<void> {
    const phoneNumber = message.from;
    const sessionId = this.client.getSession(phoneNumber);

    // Mark as read
    await this.client.markAsRead(message.id);

    // Get message content
    let userText = '';
    
    switch (message.type) {
      case 'text':
        userText = message.text || '';
        break;
      case 'button_reply':
        userText = message.buttonPayload || '';
        break;
      case 'list_reply':
        userText = message.listPayload || '';
        break;
      default:
        // Send unsupported message type response
        await this.client.sendText(
          phoneNumber,
          'عذراً، لا يمكنني معالجة هذا النوع من الرسائل حالياً. يرجى إرسال رسالة نصية.'
        );
        return;
    }

    // Handle special commands
    if (await this.handleSpecialCommands(phoneNumber, userText, sessionId)) {
      return;
    }

    // Process with advanced AI pipeline
    try {
      const startTime = Date.now();
      
      const result = await advancedChatHandler.handleChat({
        message: userText,
        userId: phoneNumber,
        channel: 'whatsapp',
      });

      const processingTime = Date.now() - startTime;

      // Record interaction
      feedbackLoop.storeInteraction({
        userId: phoneNumber,
        query: userText,
        understanding: {},
        answer: result.answer,
        confidence: result.confidence.score,
        sources: result.sources?.map((s) => ({
          id: s.id,
          text: s.text,
          chunk_type: s.chunkType,
          metadata: {},
          score: s.score,
        })) || [],
        responseTimeMs: processingTime,
        channel: 'whatsapp' as const,
      });

      // Format and send response
      await this.sendFormattedResponse(phoneNumber, {
        answer: result.answer,
        confidence: result.confidence.score,
        suggestions: result.suggestedFollowups,
        sources: result.sources?.map((s) => ({ id: s.id, title: s.title })),
        needsClarification: result.confidence.needsClarification,
        clarificationQuestion: result.suggestedFollowups?.[0],
      });

    } catch (error) {
      console.error('[WA] Processing error:', error);
      await this.client.sendText(
        phoneNumber,
        'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.'
      );
    }
  }

  /**
   * Handle special commands
   */
  private async handleSpecialCommands(
    phoneNumber: string,
    text: string,
    _sessionId: string
  ): Promise<boolean> {
    const normalizedText = text.trim().toLowerCase();

    // Help command
    if (normalizedText === 'مساعدة' || normalizedText === 'help') {
      await this.sendHelpMessage(phoneNumber);
      return true;
    }

    // Reset session command
    if (normalizedText === 'إعادة' || normalizedText === 'reset') {
      this.client.clearSession(phoneNumber);
      await this.client.sendText(phoneNumber, 'تم إعادة تعيين المحادثة. كيف يمكنني مساعدتك؟');
      return true;
    }

    // Feedback command
    if (normalizedText.startsWith('تقييم') || normalizedText.startsWith('feedback')) {
      await this.handleFeedbackCommand(phoneNumber, text);
      return true;
    }

    return false;
  }

  /**
   * Send help message
   */
  private async sendHelpMessage(phoneNumber: string): Promise<void> {
    const helpText = `🇰🇼 *مرحباً بك في موطني بوت*

أنا مساعدك الذكي للمحاربين القدامى الكويتيين.

*يمكنني مساعدتك في:*
• الاستفسار عن الرواتب والمعاشات
• شروط الاستحقاق والتعويضات
• الإجراءات والمستندات المطلوبة
• القوانين والأنظمة

*أوامر خاصة:*
• "مساعدة" - عرض هذه الرسالة
• "إعادة" - بدء محادثة جديدة
• "تقييم" - تقييم الخدمة

اكتب سؤالك وسأحاول مساعدتك! 💬`;

    await this.client.sendButtons(phoneNumber, helpText, [
      { id: 'salary_calc', title: 'حاسبة الراتب' },
      { id: 'requirements', title: ' والمتطلبات' },
      { id: 'contact', title: 'تواصل معنا' },
    ]);
  }

  /**
   * Handle feedback command
   */
  private async handleFeedbackCommand(phoneNumber: string, _text: string): Promise<void> {
    await this.client.sendButtons(
      phoneNumber,
      'شكراً لك! كيف تقيّم تجربتك مع موطني بوت؟',
      [
        { id: 'feedback_positive', title: '👍 ممتاز' },
        { id: 'feedback_neutral', title: '😐 متوسط' },
        { id: 'feedback_negative', title: '👎 يحتاج تحسين' },
      ]
    );
  }

  /**
   * Send formatted response based on AI result
   */
  private async sendFormattedResponse(
    phoneNumber: string,
    result: {
      answer: string;
      confidence: number;
      suggestions?: string[];
      sources?: Array<{ id: string; title?: string }>;
      needsClarification?: boolean;
      clarificationQuestion?: string;
    }
  ): Promise<void> {
    // If clarification needed, send with options
    if (result.needsClarification && result.clarificationQuestion) {
      await this.client.sendText(phoneNumber, result.clarificationQuestion);
      return;
    }

    // Format main answer
    let responseText = result.answer;

    // Add sources if available
    if (result.sources && result.sources.length > 0) {
      const sourcesList = result.sources
        .slice(0, 3)
        .map(s => s.title || s.id)
        .join('، ');
      responseText += `\n\n📚 _المصادر: ${sourcesList}_`;
    }

    // Add confidence indicator for low confidence
    if (result.confidence < 0.5) {
      responseText += '\n\n⚠️ _ملاحظة: قد تحتاج هذه المعلومات للتحقق من جهة رسمية_';
    }

    // Send main response
    await this.client.sendText(phoneNumber, responseText);

    // Send suggestions as quick replies if available
    if (result.suggestions && result.suggestions.length > 0) {
      const buttons = result.suggestions.slice(0, 3).map((s, i) => ({
        id: `suggestion_${i}`,
        title: s.slice(0, 20),
      }));

      await this.client.sendButtons(
        phoneNumber,
        'هل تريد الاستفسار عن أي من المواضيع التالية؟',
        buttons
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────────────

let whatsAppClientInstance: WhatsAppClient | null = null;
let whatsAppHandlerInstance: WhatsAppHandler | null = null;

export function getWhatsAppClient(): WhatsAppClient | null {
  if (!whatsAppClientInstance && process.env.WHATSAPP_API_TOKEN) {
    whatsAppClientInstance = new WhatsAppClient({
      apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v17.0',
      apiToken: process.env.WHATSAPP_API_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    });
  }
  return whatsAppClientInstance;
}

export function getWhatsAppHandler(): WhatsAppHandler | null {
  const client = getWhatsAppClient();
  if (!client) return null;

  if (!whatsAppHandlerInstance) {
    whatsAppHandlerInstance = new WhatsAppHandler(client);
  }
  return whatsAppHandlerInstance;
}

export function createWhatsAppClient(config: WhatsAppConfig): WhatsAppClient {
  whatsAppClientInstance = new WhatsAppClient(config);
  whatsAppHandlerInstance = new WhatsAppHandler(whatsAppClientInstance);
  return whatsAppClientInstance;
}
