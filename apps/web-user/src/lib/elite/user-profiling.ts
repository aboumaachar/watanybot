/**
 * User Profiling Engine - Elite Feature
 * Creates detailed personality, preference, and behavior profiles
 * Based on WATANYBOT_ELITE_VISION.md specification
 */

export interface UserDemographics {
  rank?: string;
  yearsOfService?: number;
  branch?: string;
  hasFamily?: boolean;
  childrenCount?: number;
  age?: number;
  region?: string;
}

export interface PersonalityTraits {
  communicationStyle: 'formal' | 'casual' | 'mixed';
  technicalProficiency: 'low' | 'medium' | 'high';
  patience: 'low' | 'medium' | 'high';
  detailOrientation: 'summary' | 'detailed' | 'comprehensive';
  emotionalState: 'calm' | 'stressed' | 'frustrated' | 'urgent';
}

export interface BehaviorPatterns {
  preferredTimeOfDay: string;
  averageSessionLength: number;
  typicalQueryLength: number;
  completionRate: number;
  returnFrequency: number;
  devicePreference: 'mobile' | 'desktop' | 'both';
}

export interface UserPreferences {
  language: 'ar' | 'en' | 'mixed';
  inputMethod: 'text' | 'voice' | 'both';
  responseFormat: 'concise' | 'detailed' | 'step-by-step';
  notificationFrequency: 'high' | 'medium' | 'low' | 'none';
  accessibilityNeeds: string[];
}

export interface LifeEvent {
  type: string;
  message: string;
  actions: string[];
  priority: 'high' | 'medium' | 'low';
  dueDate?: Date;
}

export interface UserInterests {
  frequentTopics: string[];
  primaryNeeds: string[];
  upcomingLifeEvents: LifeEvent[];
}

export interface UserProfile {
  userId: string;
  demographics: UserDemographics;
  personality: PersonalityTraits;
  behavior: BehaviorPatterns;
  preferences: UserPreferences;
  interests: UserInterests;
  interactionCount: number;
  lastInteraction: number;
  createdAt: number;
  updatedAt: number;
}

export interface Interaction {
  id: string;
  userId: string;
  query: string;
  response: string;
  timestamp: number;
  duration: number;
  feedback?: 'helpful' | 'not_helpful' | 'neutral';
  sentiment?: SentimentResult;
  topics: string[];
}

export interface SentimentResult {
  polarity: number;       // -1 to 1
  urgency: number;        // 0 to 1
  frustration: number;    // 0 to 1
  needsEmpathy: boolean;
}

const STORAGE_KEY = 'watany_user_profile';
const INTERACTIONS_KEY = 'watany_interactions';

/**
 * User Profiling Engine
 */
class UserProfilingEngine {
  private profile: UserProfile | null = null;
  private interactions: Interaction[] = [];
  private userId: string;

  constructor() {
    this.userId = this.getOrCreateUserId();
    this.loadProfile();
    this.loadInteractions();
  }

  private getOrCreateUserId(): string {
    let userId = localStorage.getItem('watany_user_id');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('watany_user_id', userId);
    }
    return userId;
  }

  private loadProfile(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.profile = JSON.parse(raw);
      } else {
        this.profile = this.createDefaultProfile();
        this.saveProfile();
      }
    } catch {
      this.profile = this.createDefaultProfile();
    }
  }

  private loadInteractions(): void {
    try {
      const raw = localStorage.getItem(INTERACTIONS_KEY);
      if (raw) {
        this.interactions = JSON.parse(raw);
      }
    } catch {
      this.interactions = [];
    }
  }

  private createDefaultProfile(): UserProfile {
    return {
      userId: this.userId,
      demographics: {},
      personality: {
        communicationStyle: 'mixed',
        technicalProficiency: 'medium',
        patience: 'medium',
        detailOrientation: 'detailed',
        emotionalState: 'calm',
      },
      behavior: {
        preferredTimeOfDay: 'morning',
        averageSessionLength: 0,
        typicalQueryLength: 0,
        completionRate: 0,
        returnFrequency: 0,
        devicePreference: 'both',
      },
      preferences: {
        language: 'ar',
        inputMethod: 'both',
        responseFormat: 'detailed',
        notificationFrequency: 'medium',
        accessibilityNeeds: [],
      },
      interests: {
        frequentTopics: [],
        primaryNeeds: [],
        upcomingLifeEvents: [],
      },
      interactionCount: 0,
      lastInteraction: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private saveProfile(): void {
    if (this.profile) {
      this.profile.updatedAt = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
    }
  }

  private saveInteractions(): void {
    // Keep only last 100 interactions
    const toSave = this.interactions.slice(-100);
    localStorage.setItem(INTERACTIONS_KEY, JSON.stringify(toSave));
  }

  /**
   * Track a user interaction
   */
  trackInteraction(
    query: string,
    response: string,
    duration: number,
    sentiment?: SentimentResult
  ): Interaction {
    const topics = this.extractTopics(query);
    
    const interaction: Interaction = {
      id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: this.userId,
      query,
      response,
      timestamp: Date.now(),
      duration,
      sentiment,
      topics,
    };

    this.interactions.push(interaction);
    this.saveInteractions();

    // Update profile
    if (this.profile) {
      this.profile.interactionCount++;
      this.profile.lastInteraction = Date.now();
      
      // Update behavior patterns
      this.updateBehaviorPatterns(interaction);
      
      // Update personality traits based on interaction
      this.updatePersonalityTraits(interaction);
      
      // Update interests
      this.updateInterests(topics);
      
      this.saveProfile();
    }

    return interaction;
  }

  /**
   * Record feedback for an interaction
   */
  recordFeedback(interactionId: string, feedback: 'helpful' | 'not_helpful' | 'neutral'): void {
    const interaction = this.interactions.find(i => i.id === interactionId);
    if (interaction) {
      interaction.feedback = feedback;
      this.saveInteractions();
    }
  }

  /**
   * Extract topics from query
   */
  private extractTopics(query: string): string[] {
    const topics: string[] = [];
    const q = query.toLowerCase();

    const TOPIC_KEYWORDS: Record<string, string[]> = {
      'salary': ['راتب', 'معاش', 'رواتب', 'قبض', 'مالية'],
      'retirement': ['تقاعد', 'متقاعد', 'استقالة', 'نهاية خدمة'],
      'health': ['صحة', 'مستشفى', 'طبيب', 'علاج', 'مرض', 'دواء'],
      'documents': ['وثيقة', 'مستند', 'ورقة', 'شهادة', 'إفادة'],
      'family': ['عائلة', 'زوجة', 'أولاد', 'أطفال', 'عاتق'],
      'leave': ['إجازة', 'عطلة', 'غياب'],
      'housing': ['سكن', 'منزل', 'بيت', 'إسكان'],
      'education': ['تعليم', 'مدرسة', 'جامعة', 'منحة', 'دراسة'],
      'legal': ['قانون', 'حق', 'قضاء', 'محكمة', 'شكوى'],
      'procedures': ['معاملة', 'إجراء', 'طلب', 'تقديم'],
    };

    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (keywords.some(kw => q.includes(kw))) {
        topics.push(topic);
      }
    }

    return topics;
  }

  /**
   * Update behavior patterns based on interaction
   */
  private updateBehaviorPatterns(interaction: Interaction): void {
    if (!this.profile) return;

    // Update average query length
    const avgLen = this.profile.behavior.typicalQueryLength;
    const count = this.profile.interactionCount;
    this.profile.behavior.typicalQueryLength = (avgLen * (count - 1) + interaction.query.length) / count;

    // Update average session length
    const avgDur = this.profile.behavior.averageSessionLength;
    this.profile.behavior.averageSessionLength = (avgDur * (count - 1) + interaction.duration) / count;

    // Update preferred time of day
    const hour = new Date(interaction.timestamp).getHours();
    if (hour >= 5 && hour < 12) {
      this.profile.behavior.preferredTimeOfDay = 'morning';
    } else if (hour >= 12 && hour < 17) {
      this.profile.behavior.preferredTimeOfDay = 'afternoon';
    } else {
      this.profile.behavior.preferredTimeOfDay = 'evening';
    }

    // Detect device preference
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      this.profile.behavior.devicePreference = this.profile.behavior.devicePreference === 'desktop' ? 'both' : 'mobile';
    } else {
      this.profile.behavior.devicePreference = this.profile.behavior.devicePreference === 'mobile' ? 'both' : 'desktop';
    }
  }

  /**
   * Update personality traits based on interaction patterns
   */
  private updatePersonalityTraits(interaction: Interaction): void {
    if (!this.profile) return;

    // Detect communication style from query
    const query = interaction.query;
    const formalIndicators = ['أرجو', 'يرجى', 'أودّ', 'هل يمكن', 'من فضلك'];
    const casualIndicators = ['بدي', 'شو', 'كيف', 'ليش', 'هلق'];

    let formalScore = 0;
    let casualScore = 0;

    formalIndicators.forEach(indicator => {
      if (query.includes(indicator)) formalScore++;
    });
    casualIndicators.forEach(indicator => {
      if (query.includes(indicator)) casualScore++;
    });

    if (formalScore > casualScore) {
      this.profile.personality.communicationStyle = 'formal';
    } else if (casualScore > formalScore) {
      this.profile.personality.communicationStyle = 'casual';
    }

    // Update emotional state based on sentiment
    if (interaction.sentiment) {
      if (interaction.sentiment.frustration > 0.6) {
        this.profile.personality.emotionalState = 'frustrated';
      } else if (interaction.sentiment.urgency > 0.7) {
        this.profile.personality.emotionalState = 'urgent';
      } else if (interaction.sentiment.frustration > 0.3) {
        this.profile.personality.emotionalState = 'stressed';
      } else {
        this.profile.personality.emotionalState = 'calm';
      }
    }
  }

  /**
   * Update user interests based on topics
   */
  private updateInterests(topics: string[]): void {
    if (!this.profile) return;

    topics.forEach(topic => {
      if (!this.profile!.interests.frequentTopics.includes(topic)) {
        this.profile!.interests.frequentTopics.push(topic);
      }
    });

    // Keep only top 10 frequent topics
    this.profile.interests.frequentTopics = this.profile.interests.frequentTopics.slice(-10);

    // Update primary needs based on frequency
    const topicCounts: Record<string, number> = {};
    this.interactions.forEach(int => {
      int.topics.forEach(t => {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      });
    });

    this.profile.interests.primaryNeeds = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);
  }

  /**
   * Predict upcoming needs based on profile
   */
  predictNeeds(): LifeEvent[] {
    const needs: LifeEvent[] = [];
    if (!this.profile) return needs;

    // Retirement approaching (if years of service >= 18)
    if (this.profile.demographics.yearsOfService && this.profile.demographics.yearsOfService >= 18) {
      needs.push({
        type: 'retirement',
        message: `بقي ${20 - this.profile.demographics.yearsOfService} سنوات على تقاعدك. هل تريد البدء بالمعاملات؟`,
        actions: ['retirement_guide', 'pension_calc'],
        priority: 'high',
      });
    }

    // Children education (if has children)
    if (this.profile.demographics.childrenCount && this.profile.demographics.childrenCount > 0) {
      needs.push({
        type: 'education',
        message: `لديك أولاد مسجّلون. هل تعلم أن لديك مساعدات مدرسية متاحة؟`,
        actions: ['scholarships', 'school_list'],
        priority: 'medium',
      });
    }

    // Health check reminder based on frequent health queries
    if (this.profile.interests.primaryNeeds.includes('health')) {
      needs.push({
        type: 'health',
        message: 'لاحظنا اهتمامك بالشؤون الصحية. هل تحتاج مساعدة في حجز موعد؟',
        actions: ['hospital_appointment', 'health_services'],
        priority: 'medium',
      });
    }

    return needs;
  }

  /**
   * Get current profile
   */
  getProfile(): UserProfile | null {
    return this.profile;
  }

  /**
   * Update demographics
   */
  updateDemographics(demographics: Partial<UserDemographics>): void {
    if (this.profile) {
      this.profile.demographics = { ...this.profile.demographics, ...demographics };
      this.saveProfile();
    }
  }

  /**
   * Update preferences
   */
  updatePreferences(preferences: Partial<UserPreferences>): void {
    if (this.profile) {
      this.profile.preferences = { ...this.profile.preferences, ...preferences };
      this.saveProfile();
    }
  }

  /**
   * Get recent interactions
   */
  getRecentInteractions(limit = 10): Interaction[] {
    return this.interactions.slice(-limit);
  }

  /**
   * Get welcome message based on profile
   */
  getWelcomeMessage(): string {
    if (!this.profile) return 'أهلاً وسهلاً! كيف يمكنني مساعدتك؟';

    const lastInteraction = this.profile.lastInteraction;
    const daysSinceLastVisit = Math.floor((Date.now() - lastInteraction) / (1000 * 60 * 60 * 24));

    if (daysSinceLastVisit > 7) {
      return `أهلاً بعودتك! مرّ علينا ${daysSinceLastVisit} يوم. كيف يمكنني مساعدتك اليوم؟`;
    }

    // Check for incomplete tasks/needs
    const needs = this.predictNeeds();
    if (needs.length > 0 && needs[0].priority === 'high') {
      return `أهلاً! تذكير: ${needs[0].message}`;
    }

    // Personalized greeting based on time of day
    const hour = new Date().getHours();
    let greeting = 'أهلاً!';
    if (hour >= 5 && hour < 12) {
      greeting = 'صباح الخير!';
    } else if (hour >= 12 && hour < 17) {
      greeting = 'مساء الخير!';
    } else {
      greeting = 'مساء النور!';
    }

    return `${greeting} كيف يمكنني مساعدتك؟`;
  }

  /**
   * Adapt response style to user personality
   */
  adaptResponse(response: string): string {
    if (!this.profile) return response;

    let adapted = response;

    // Adjust formality
    if (this.profile.personality.communicationStyle === 'casual') {
      adapted = adapted
        .replace(/يرجى/g, 'من فضلك')
        .replace(/يمكنك/g, 'فيك')
        .replace(/لا يوجد/g, 'ما في');
    }

    // Add empathy for frustrated users
    if (this.profile.personality.emotionalState === 'frustrated') {
      adapted = `أفهم إنّك منزعج، وأنا هون لساعدك. ${adapted}`;
    }

    // Add urgency acknowledgment
    if (this.profile.personality.emotionalState === 'urgent') {
      adapted = `بفهم إنو الموضوع ضروري. ${adapted}`;
    }

    return adapted;
  }
}

// Singleton instance
export const userProfiling = new UserProfilingEngine();
