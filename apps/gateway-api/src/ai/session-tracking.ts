/**
 * Watany Session Tracking Engine
 * 
 * Phase 3: Advanced session management and conversation context
 * - Multi-turn conversation tracking
 * - Session state management
 * - Context carryover between turns
 * - Session analytics and insights
 */

import { randomUUID } from 'crypto';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: string;
    entities?: Record<string, unknown>;
    confidence?: number;
    sources?: string[];
    processingTimeMs?: number;
  };
}

export interface SessionContext {
  topic?: string;
  entities: Map<string, unknown>;
  referencedChunks: Set<string>;
  clarifications: string[];
  userPreferences: Record<string, unknown>;
}

export interface Session {
  id: string;
  userId?: string;
  channel: 'web' | 'whatsapp' | 'api';
  messages: SessionMessage[];
  context: SessionContext;
  state: 'active' | 'idle' | 'completed' | 'expired';
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  analytics: SessionAnalytics;
}

export interface SessionAnalytics {
  turnCount: number;
  avgResponseTimeMs: number;
  totalResponseTimeMs: number;
  topicsDiscussed: string[];
  entitiesMentioned: string[];
  clarificationCount: number;
  feedbackCount: number;
  avgConfidence: number;
}

export interface SessionConfig {
  maxMessages: number;
  sessionTimeoutMs: number;
  idleTimeoutMs: number;
  maxActiveSessions: number;
}

// ─────────────────────────────────────────────────────────────────────
// Session Store
// ─────────────────────────────────────────────────────────────────────

export class SessionStore {
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private config: SessionConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<SessionConfig>) {
    this.config = {
      maxMessages: config?.maxMessages || 100,
      sessionTimeoutMs: config?.sessionTimeoutMs || 24 * 60 * 60 * 1000, // 24 hours
      idleTimeoutMs: config?.idleTimeoutMs || 30 * 60 * 1000, // 30 minutes
      maxActiveSessions: config?.maxActiveSessions || 10000,
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Create new session
   */
  create(userId?: string, channel: Session['channel'] = 'web'): Session {
    const now = new Date();
    const sessionId = `session_${randomUUID()}`;

    const session: Session = {
      id: sessionId,
      userId,
      channel,
      messages: [],
      context: {
        entities: new Map(),
        referencedChunks: new Set(),
        clarifications: [],
        userPreferences: {},
      },
      state: 'active',
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + this.config.sessionTimeoutMs),
      analytics: {
        turnCount: 0,
        avgResponseTimeMs: 0,
        totalResponseTimeMs: 0,
        topicsDiscussed: [],
        entitiesMentioned: [],
        clarificationCount: 0,
        feedbackCount: 0,
        avgConfidence: 0,
      },
    };

    this.sessions.set(sessionId, session);

    // Track user sessions
    if (userId) {
      if (!this.userSessions.has(userId)) {
        this.userSessions.set(userId, new Set());
      }
      this.userSessions.get(userId)!.add(sessionId);
    }

    return session;
  }

  /**
   * Get session by ID
   */
  get(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      // Check if expired
      if (new Date() > session.expiresAt) {
        session.state = 'expired';
      }
      
      // Check if idle
      const idleTime = Date.now() - session.updatedAt.getTime();
      if (session.state === 'active' && idleTime > this.config.idleTimeoutMs) {
        session.state = 'idle';
      }
    }

    return session;
  }

  /**
   * Get or create session
   */
  getOrCreate(sessionId: string | undefined, userId?: string, channel?: Session['channel']): Session {
    if (sessionId) {
      const existing = this.get(sessionId);
      if (existing && existing.state !== 'expired') {
        return existing;
      }
    }
    return this.create(userId, channel);
  }

  /**
   * Add message to session
   */
  addMessage(sessionId: string, message: Omit<SessionMessage, 'id' | 'timestamp'>): SessionMessage | null {
    const session = this.get(sessionId);
    if (!session) return null;

    const fullMessage: SessionMessage = {
      ...message,
      id: `msg_${randomUUID()}`,
      timestamp: new Date(),
    };

    // Enforce max messages (sliding window)
    if (session.messages.length >= this.config.maxMessages) {
      session.messages.shift();
    }

    session.messages.push(fullMessage);
    session.updatedAt = new Date();
    session.state = 'active';

    // Update analytics
    if (message.role === 'user') {
      session.analytics.turnCount++;
    }
    
    if (message.metadata?.processingTimeMs) {
      session.analytics.totalResponseTimeMs += message.metadata.processingTimeMs;
      const assistantCount = session.messages.filter(m => m.role === 'assistant').length;
      session.analytics.avgResponseTimeMs = session.analytics.totalResponseTimeMs / (assistantCount || 1);
    }

    if (message.metadata?.confidence) {
      const totalConfidence = session.analytics.avgConfidence * (session.analytics.turnCount - 1) + message.metadata.confidence;
      session.analytics.avgConfidence = totalConfidence / session.analytics.turnCount;
    }

    if (message.metadata?.intent) {
      if (!session.analytics.topicsDiscussed.includes(message.metadata.intent)) {
        session.analytics.topicsDiscussed.push(message.metadata.intent);
      }
    }

    return fullMessage;
  }

  /**
   * Update session context
   */
  updateContext(sessionId: string, updates: Partial<SessionContext>): boolean {
    const session = this.get(sessionId);
    if (!session) return false;

    if (updates.topic) {
      session.context.topic = updates.topic;
    }

    if (updates.entities) {
      for (const [key, value] of updates.entities) {
        session.context.entities.set(key, value);
        if (!session.analytics.entitiesMentioned.includes(key)) {
          session.analytics.entitiesMentioned.push(key);
        }
      }
    }

    if (updates.referencedChunks) {
      for (const chunkId of updates.referencedChunks) {
        session.context.referencedChunks.add(chunkId);
      }
    }

    if (updates.clarifications) {
      session.context.clarifications.push(...updates.clarifications);
      session.analytics.clarificationCount += updates.clarifications.length;
    }

    if (updates.userPreferences) {
      Object.assign(session.context.userPreferences, updates.userPreferences);
    }

    session.updatedAt = new Date();
    return true;
  }

  /**
   * Get user's sessions
   */
  getUserSessions(userId: string): Session[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return [];

    return Array.from(sessionIds)
      .map(id => this.get(id))
      .filter((s): s is Session => s !== undefined)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Get conversation history for context
   */
  getConversationContext(sessionId: string, maxTurns = 5): string {
    const session = this.get(sessionId);
    if (!session || session.messages.length === 0) return '';

    // Get last N turns
    const recentMessages = session.messages.slice(-maxTurns * 2);
    
    return recentMessages
      .map(m => `${m.role === 'user' ? 'المستخدم' : 'المساعد'}: ${m.content}`)
      .join('\n');
  }

  /**
   * Get referenced context from previous turns
   */
  getReferencedContext(sessionId: string): Map<string, unknown> {
    const session = this.get(sessionId);
    if (!session) return new Map();
    
    return session.context.entities;
  }

  /**
   * Complete session
   */
  complete(sessionId: string): boolean {
    const session = this.get(sessionId);
    if (!session) return false;

    session.state = 'completed';
    session.updatedAt = new Date();
    return true;
  }

  /**
   * Delete session
   */
  delete(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Remove from user sessions tracking
    if (session.userId) {
      const userSet = this.userSessions.get(session.userId);
      if (userSet) {
        userSet.delete(sessionId);
        if (userSet.size === 0) {
          this.userSessions.delete(session.userId);
        }
      }
    }

    return this.sessions.delete(sessionId);
  }

  /**
   * Cleanup expired sessions
   */
  cleanup(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiresAt || session.state === 'expired') {
        this.delete(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get session statistics
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    idleSessions: number;
    completedSessions: number;
    expiredSessions: number;
    avgTurnCount: number;
    avgResponseTime: number;
  } {
    let active = 0;
    let idle = 0;
    let completed = 0;
    let expired = 0;
    let totalTurns = 0;
    let totalResponseTime = 0;

    for (const session of this.sessions.values()) {
      switch (session.state) {
        case 'active': active++; break;
        case 'idle': idle++; break;
        case 'completed': completed++; break;
        case 'expired': expired++; break;
      }
      totalTurns += session.analytics.turnCount;
      totalResponseTime += session.analytics.avgResponseTimeMs;
    }

    const total = this.sessions.size;

    return {
      totalSessions: total,
      activeSessions: active,
      idleSessions: idle,
      completedSessions: completed,
      expiredSessions: expired,
      avgTurnCount: total > 0 ? totalTurns / total : 0,
      avgResponseTime: total > 0 ? totalResponseTime / total : 0,
    };
  }

  /**
   * Export sessions for persistence
   */
  export(): Session[] {
    return Array.from(this.sessions.values()).map(session => ({
      ...session,
      context: {
        ...session.context,
        entities: Object.fromEntries(session.context.entities) as unknown as Map<string, unknown>,
        referencedChunks: Array.from(session.context.referencedChunks) as unknown as Set<string>,
      },
    }));
  }

  /**
   * Import sessions from persistence
   */
  import(sessions: Session[]): void {
    for (const session of sessions) {
      // Reconstruct Maps and Sets
      session.context.entities = new Map(Object.entries(session.context.entities as unknown as Record<string, unknown>));
      session.context.referencedChunks = new Set(session.context.referencedChunks as unknown as string[]);
      
      // Convert dates
      session.createdAt = new Date(session.createdAt);
      session.updatedAt = new Date(session.updatedAt);
      session.expiresAt = new Date(session.expiresAt);
      
      for (const msg of session.messages) {
        msg.timestamp = new Date(msg.timestamp);
      }

      this.sessions.set(session.id, session);

      if (session.userId) {
        if (!this.userSessions.has(session.userId)) {
          this.userSessions.set(session.userId, new Set());
        }
        this.userSessions.get(session.userId)!.add(session.id);
      }
    }
  }

  /**
   * Shutdown cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Session-Aware Context Builder
// ─────────────────────────────────────────────────────────────────────

export class SessionContextBuilder {
  private sessionStore: SessionStore;

  constructor(sessionStore: SessionStore) {
    this.sessionStore = sessionStore;
  }

  /**
   * Build enriched context for a query
   */
  buildContext(
    sessionId: string,
    currentQuery: string
  ): {
    conversationHistory: string;
    referencedEntities: Record<string, unknown>;
    previousTopics: string[];
    clarifications: string[];
    shouldClarify: boolean;
    contextualHints: string[];
  } {
    const session = this.sessionStore.get(sessionId);
    
    if (!session) {
      return {
        conversationHistory: '',
        referencedEntities: {},
        previousTopics: [],
        clarifications: [],
        shouldClarify: false,
        contextualHints: [],
      };
    }

    // Build conversation history
    const conversationHistory = this.sessionStore.getConversationContext(sessionId, 5);

    // Get referenced entities
    const referencedEntities = Object.fromEntries(session.context.entities);

    // Get previous topics
    const previousTopics = session.analytics.topicsDiscussed;

    // Get past clarifications
    const clarifications = session.context.clarifications;

    // Determine if we should clarify
    const shouldClarify = this.shouldRequestClarification(session, currentQuery);

    // Build contextual hints based on conversation flow
    const contextualHints = this.buildContextualHints(session, currentQuery);

    return {
      conversationHistory,
      referencedEntities,
      previousTopics,
      clarifications,
      shouldClarify,
      contextualHints,
    };
  }

  /**
   * Determine if clarification is needed
   */
  private shouldRequestClarification(session: Session, query: string): boolean {
    // Check for ambiguous pronouns without context
    const hasPronouns = /هذا|هذه|ذلك|تلك|هو|هي|هم|نفسه|نفس/.test(query);
    const hasContext = session.context.entities.size > 0;

    if (hasPronouns && !hasContext) {
      return true;
    }

    // Check if query is too short and lacks context
    if (query.length < 10 && session.messages.length === 0) {
      return true;
    }

    // Check for repeated clarification failures
    if (session.analytics.clarificationCount > 2) {
      return false; // Don't keep asking
    }

    return false;
  }

  /**
   * Build contextual hints for better response
   */
  private buildContextualHints(session: Session, _query: string): string[] {
    const hints: string[] = [];

    // Add topic continuity hint
    if (session.context.topic) {
      hints.push(`الموضوع الحالي: ${session.context.topic}`);
    }

    // Add referenced law/article hints
    for (const [key, value] of session.context.entities) {
      if (key.includes('قانون') || key.includes('مادة')) {
        hints.push(`مرجع: ${key} = ${value}`);
      }
    }

    // Add user preference hints
    if (session.context.userPreferences.rank) {
      hints.push(`رتبة المستخدم: ${session.context.userPreferences.rank}`);
    }

    if (session.context.userPreferences.yearsOfService) {
      hints.push(`سنوات الخدمة: ${session.context.userPreferences.yearsOfService}`);
    }

    return hints;
  }

  /**
   * Resolve pronouns and references
   */
  resolveReferences(sessionId: string, query: string): string {
    const session = this.sessionStore.get(sessionId);
    if (!session) return query;

    let resolved = query;

    // Replace pronouns with last mentioned entity if available
    const lastTopic = session.context.topic;
    if (lastTopic) {
      resolved = resolved
        .replace(/\bهذا\b/g, lastTopic)
        .replace(/\bهذه\b/g, lastTopic)
        .replace(/\bذلك\b/g, lastTopic)
        .replace(/\bتلك\b/g, lastTopic);
    }

    // Replace entity references
    for (const [key, value] of session.context.entities) {
      const pattern = new RegExp(`\\b${key}\\b`, 'g');
      if (typeof value === 'string') {
        resolved = resolved.replace(pattern, value);
      }
    }

    return resolved;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Factory and Singleton
// ─────────────────────────────────────────────────────────────────────

let sessionStoreInstance: SessionStore | null = null;
let contextBuilderInstance: SessionContextBuilder | null = null;

export function getSessionStore(): SessionStore {
  if (!sessionStoreInstance) {
    sessionStoreInstance = new SessionStore({
      maxMessages: parseInt(process.env.SESSION_MAX_MESSAGES || '100'),
      sessionTimeoutMs: parseInt(process.env.SESSION_TIMEOUT_MS || '86400000'),
      idleTimeoutMs: parseInt(process.env.SESSION_IDLE_TIMEOUT_MS || '1800000'),
      maxActiveSessions: parseInt(process.env.SESSION_MAX_ACTIVE || '10000'),
    });
  }
  return sessionStoreInstance;
}

export function getSessionContextBuilder(): SessionContextBuilder {
  if (!contextBuilderInstance) {
    contextBuilderInstance = new SessionContextBuilder(getSessionStore());
  }
  return contextBuilderInstance;
}

export function createSessionStore(config: SessionConfig): SessionStore {
  sessionStoreInstance = new SessionStore(config);
  contextBuilderInstance = new SessionContextBuilder(sessionStoreInstance);
  return sessionStoreInstance;
}
