/**
 * Emotional AI - Elite Feature
 * Sentiment analysis, crisis detection, and empathy engine
 * Based on WATANYBOT_ELITE_VISION.md specification
 */

export interface EmotionalState {
  sentiment: 'positive' | 'negative' | 'neutral';
  polarity: number;        // -1 to 1
  urgency: number;         // 0 to 1
  frustration: number;     // 0 to 1
  needsEmpathy: boolean;
  isCrisis: boolean;
  emotions: string[];
}

export interface CrisisAssessment {
  isCrisis: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  indicators: string[];
  recommendedAction: string;
  resources: CrisisResource[];
}

export interface CrisisResource {
  id: string;
  name_ar: string;
  description_ar: string;
  phone?: string;
  url?: string;
  available: string;
  type: 'hotline' | 'hospital' | 'support_group' | 'online';
}

// Crisis detection keywords
const CRISIS_KEYWORDS = {
  high: [
    'انتحار', 'أقتل نفسي', 'موت', 'أموت', 'ما بدي عيش',
    'نهاية حياتي', 'أريد الموت', 'بدي موت', 'خلّصني',
  ],
  medium: [
    'مكتئب', 'يأس', 'يائس', 'ما في أمل', 'ما في فايدة',
    'تعبت', 'ما بقدر', 'انهيار', 'مش قادر أكمّل',
    'حزين كتير', 'مش قادر نام', 'كوابيس',
  ],
  low: [
    'قلق', 'خايف', 'وحيد', 'ما في حدا', 'منعزل',
    'صعب', 'ضغط', 'توتر', 'عصبية',
  ],
};

// Frustration indicators
const FRUSTRATION_KEYWORDS = [
  'مش معقول', 'ليش هيك', 'بكفّي', 'تعبت', 'مش مقبول',
  'ما حدا بساعدني', 'ما رح ينفع', 'ضيّعتوا وقتي', 'كل مرة نفس الشي',
  'مين المسؤول', 'بدي أشتكي', 'حقي', 'ظلم',
];

// Urgency indicators
const URGENCY_KEYWORDS = [
  'ضروري', 'فوري', 'بسرعة', 'هلق', 'اليوم', 'الآن',
  'ما في وقت', 'لازم', 'عاجل', 'حالاً', 'مستعجل',
];

// Positive indicators
const POSITIVE_KEYWORDS = [
  'شكراً', 'ممتاز', 'تمام', 'حلو', 'مفيد', 'ساعدتني',
  'عظيم', 'رائع', 'مبسوط', 'سعيد', 'أفادني',
];

// PTSD-related triggers to handle sensitively
const PTSD_TRIGGERS = [
  'حرب', 'انفجار', 'قصف', 'شهيد', 'استشهد',
  'جروح', 'إصابة', 'معركة', 'جبهة', 'عدو',
  'كوابيس', 'فلاش باك', 'ذكريات مؤلمة',
];

// Mental health resources for Lebanese veterans
const MENTAL_HEALTH_RESOURCES: CrisisResource[] = [
  {
    id: 'embrace',
    name_ar: 'خط دعم نفسي - Embrace',
    description_ar: 'خط مساعدة نفسية مجاني وسري على مدار الساعة',
    phone: '1564',
    available: '24/7',
    type: 'hotline',
  },
  {
    id: 'redcross',
    name_ar: 'الصليب الأحمر اللبناني',
    description_ar: 'خدمات طوارئ وإسعاف',
    phone: '140',
    available: '24/7',
    type: 'hotline',
  },
  {
    id: 'military_hospital',
    name_ar: 'المستشفى العسكري المركزي',
    description_ar: 'قسم الصحة النفسية للعسكريين',
    phone: '01-XXXXXX',
    available: 'أيام الأسبوع ٨-٤',
    type: 'hospital',
  },
  {
    id: 'veterans_support',
    name_ar: 'جمعية دعم المتقاعدين العسكريين',
    description_ar: 'مجموعات دعم ومساعدة اجتماعية',
    phone: '01-XXXXXX',
    available: 'أيام الأسبوع',
    type: 'support_group',
  },
  {
    id: 'online_support',
    name_ar: ' النفسي عبر الإنترنت',
    description_ar: 'استشارات نفسية مجانية عبر الفيديو',
    url: 'https://mindspace.lb',
    available: 'حسب الموعد',
    type: 'online',
  },
];

/**
 * Emotional Intelligence Engine
 */
class EmotionalIntelligence {
  /**
   * Analyze emotional state from text
   */
  analyzeEmotion(text: string): EmotionalState {
    const q = text.toLowerCase();

    // Detect crisis indicators
    const crisisResult = this.detectCrisis(text);

    // Calculate frustration level
    const frustration = this.calculateFrustration(q);

    // Calculate urgency level
    const urgency = this.calculateUrgency(q);

    // Calculate sentiment polarity
    const polarity = this.calculatePolarity(q);

    // Determine overall sentiment
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (polarity > 0.2) sentiment = 'positive';
    else if (polarity < -0.2) sentiment = 'negative';

    // Identify specific emotions
    const emotions = this.identifyEmotions(q);

    // Determine if empathy is needed
    const needsEmpathy = frustration > 0.4 || crisisResult.isCrisis || polarity < -0.3;

    return {
      sentiment,
      polarity,
      urgency,
      frustration,
      needsEmpathy,
      isCrisis: crisisResult.isCrisis,
      emotions,
    };
  }

  /**
   * Detect mental health crisis indicators
   */
  detectCrisis(text: string): CrisisAssessment {
    const q = text.toLowerCase();
    const indicators: string[] = [];
    let severityScore = 0;

    // Check high-severity keywords
    CRISIS_KEYWORDS.high.forEach(keyword => {
      if (q.includes(keyword)) {
        indicators.push(keyword);
        severityScore += 3;
      }
    });

    // Check medium-severity keywords
    CRISIS_KEYWORDS.medium.forEach(keyword => {
      if (q.includes(keyword)) {
        indicators.push(keyword);
        severityScore += 2;
      }
    });

    // Check low-severity keywords
    CRISIS_KEYWORDS.low.forEach(keyword => {
      if (q.includes(keyword)) {
        indicators.push(keyword);
        severityScore += 1;
      }
    });

    // Determine severity
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (severityScore >= 6) severity = 'critical';
    else if (severityScore >= 4) severity = 'high';
    else if (severityScore >= 2) severity = 'medium';

    const isCrisis = severityScore >= 2;

    // Determine recommended action
    let recommendedAction = '';
    if (severity === 'critical') {
      recommendedAction = 'show_crisis_modal_immediate';
    } else if (severity === 'high') {
      recommendedAction = 'show_crisis_resources';
    } else if (severity === 'medium') {
      recommendedAction = 'show_support_info';
    }

    return {
      isCrisis,
      severity,
      indicators,
      recommendedAction,
      resources: isCrisis ? MENTAL_HEALTH_RESOURCES : [],
    };
  }

  /**
   * Check for PTSD triggers
   */
  detectPTSDTriggers(text: string): { hasTriggers: boolean; triggers: string[] } {
    const q = text.toLowerCase();
    const triggers: string[] = [];

    PTSD_TRIGGERS.forEach(trigger => {
      if (q.includes(trigger)) {
        triggers.push(trigger);
      }
    });

    return {
      hasTriggers: triggers.length > 0,
      triggers,
    };
  }

  /**
   * Calculate frustration level (0-1)
   */
  private calculateFrustration(text: string): number {
    let score = 0;
    const maxScore = FRUSTRATION_KEYWORDS.length;

    FRUSTRATION_KEYWORDS.forEach(keyword => {
      if (text.includes(keyword)) {
        score += 1;
      }
    });

    // Check for exclamation marks (frustration indicator)
    const exclamations = (text.match(/!/g) || []).length;
    score += Math.min(exclamations * 0.2, 1);

    // Check for repetition (e.g., "ليش ليش ليش")
    const repeats = text.match(/(\S+)\s+\1/g);
    if (repeats) {
      score += repeats.length * 0.3;
    }

    // Check for caps lock (in Arabic this might be repetition of letters)
    const repeatedLetters = text.match(/(.)\1{3,}/g);
    if (repeatedLetters) {
      score += repeatedLetters.length * 0.2;
    }

    return Math.min(score / maxScore, 1);
  }

  /**
   * Calculate urgency level (0-1)
   */
  private calculateUrgency(text: string): number {
    let score = 0;
    const maxScore = URGENCY_KEYWORDS.length;

    URGENCY_KEYWORDS.forEach(keyword => {
      if (text.includes(keyword)) {
        score += 1;
      }
    });

    // Check for time-related urgency
    if (text.includes('اليوم') || text.includes('هلق') || text.includes('الآن')) {
      score += 1;
    }

    // Check for deadline mentions
    if (text.match(/قبل\s+\d+|خلال\s+\d+/)) {
      score += 1;
    }

    return Math.min(score / maxScore, 1);
  }

  /**
   * Calculate sentiment polarity (-1 to 1)
   */
  private calculatePolarity(text: string): number {
    let positiveScore = 0;
    let negativeScore = 0;

    // Count positive words
    POSITIVE_KEYWORDS.forEach(keyword => {
      if (text.includes(keyword)) {
        positiveScore += 1;
      }
    });

    // Count negative indicators (frustration + crisis)
    FRUSTRATION_KEYWORDS.forEach(keyword => {
      if (text.includes(keyword)) {
        negativeScore += 0.5;
      }
    });

    CRISIS_KEYWORDS.medium.forEach(keyword => {
      if (text.includes(keyword)) {
        negativeScore += 1;
      }
    });

    CRISIS_KEYWORDS.high.forEach(keyword => {
      if (text.includes(keyword)) {
        negativeScore += 2;
      }
    });

    const totalScore = positiveScore + negativeScore;
    if (totalScore === 0) return 0;

    return (positiveScore - negativeScore) / totalScore;
  }

  /**
   * Identify specific emotions from text
   */
  private identifyEmotions(text: string): string[] {
    const emotions: string[] = [];

    const EMOTION_MAP: Record<string, string[]> = {
      'anger': ['غاضب', 'زعلان', 'معصّب', 'مجنّن'],
      'sadness': ['حزين', 'مكتئب', 'يائس', 'كآبة'],
      'fear': ['خايف', 'قلق', 'مرعوب', 'مخوّف'],
      'joy': ['مبسوط', 'سعيد', 'فرحان', 'ممتن'],
      'frustration': FRUSTRATION_KEYWORDS,
      'urgency': URGENCY_KEYWORDS,
      'gratitude': ['شكراً', 'ممتن', 'مقدّر'],
    };

    for (const [emotion, keywords] of Object.entries(EMOTION_MAP)) {
      if (keywords.some(kw => text.includes(kw))) {
        emotions.push(emotion);
      }
    }

    return emotions;
  }

  /**
   * Generate empathetic prefix based on emotional state
   */
  generateEmpathyPrefix(state: EmotionalState): string {
    if (state.isCrisis) {
      return 'أنا هون معك. سلامتك أهم شي. ';
    }

    if (state.frustration > 0.6) {
      return 'بفهم إنّك منزعج، وحقّك. خلّيني ساعدك. ';
    }

    if (state.frustration > 0.3) {
      return 'بفهم عليك. ';
    }

    if (state.urgency > 0.7) {
      return 'بفهم إنو الموضوع مستعجل. ';
    }

    if (state.emotions.includes('sadness')) {
      return 'بتمنّى تكون بخير. ';
    }

    if (state.emotions.includes('fear')) {
      return 'لا تقلق، رح نلاقي حل سوا. ';
    }

    if (state.sentiment === 'negative') {
      return 'أنا معك وبساعدك. ';
    }

    return '';
  }

  /**
   * Get crisis resources
   */
  getCrisisResources(): CrisisResource[] {
    return MENTAL_HEALTH_RESOURCES;
  }

  /**
   * Get primary crisis hotline
   */
  getPrimaryCrisisHotline(): CrisisResource | undefined {
    return MENTAL_HEALTH_RESOURCES.find(r => r.id === 'embrace');
  }
}

// Singleton instance
export const emotionalAI = new EmotionalIntelligence();
