/**
 * Watany Query Understanding Layer (QUL)
 * 
 * Deep query analysis before retrieval:
 * - Intent detection (multi-label)
 * - Complexity assessment
 * - Entity extraction
 * - Temporal context analysis
 * - Implicit intent detection
 */

export type Intent = 
  | 'find_information'      // عايز أعرف  
  | 'calculate_salary'      // احسب راتبي
  | 'calculate_pension'     // احسب معاشي
  | 'get_procedure'         // كيف أعمل
  | 'download_form'         // أريد النموذج
  | 'compare_options'       // قارن بين
  | 'retrieve_history'      // كان راتبي في 2019
  | 'request_action'        // أريد طلب زيادة
  | 'check_eligibility'     // هل يحق لي
  | 'get_contact'           // رقم الهاتف
  | 'clarify_previous'      // ما فهمت
  | 'greeting'              // صباح الخير
  | 'complaint';            // شكوى

export type QueryType = 'factual' | 'procedural' | 'analytical' | 'conversational' | 'calculation';

export type ComplexityLevel = 'simple' | 'moderate' | 'complex' | 'multi_hop';

export interface Entity {
  type: 'date' | 'year' | 'amount' | 'rank' | 'document' | 'form_code' | 'location' | 'person' | 'topic';
  value: string;
  normalized?: string;
  position: { start: number; end: number };
}

export interface TemporalContext {
  hasTemporal: boolean;
  references: Array<{
    type: 'past' | 'present' | 'future' | 'range';
    value: string;
    year?: number;
  }>;
}

export interface Ambiguity {
  type: 'unclear_intent' | 'missing_entity' | 'vague_reference';
  description: string;
  clarifyingQuestion: string;
}

export interface QueryUnderstanding {
  // Original query
  originalQuery: string;
  normalizedQuery: string;
  language: 'ar' | 'en' | 'mixed';
  
  // Intent analysis
  primaryIntent: Intent;
  secondaryIntents: Intent[];
  queryType: QueryType;
  
  // Entity extraction
  entities: Entity[];
  temporalContext: TemporalContext;
  
  // Complexity assessment
  complexity: ComplexityLevel;
  requiresCalculation: boolean;
  requiresComparison: boolean;
  requiresMultipleSources: boolean;
  
  // Implicit needs
  implicitIntents: string[];
  
  // Confidence
  understandingConfidence: number;
  ambiguities: Ambiguity[];
  
  // Metadata
  queryTokens: string[];
  processingTimeMs: number;
}

// ─────────────────────────────────────────────────────────────────────
// Arabic NLP utilities
// ─────────────────────────────────────────────────────────────────────

const ARABIC_STOPWORDS = new Set([
  'لم', 'لا', 'ما', 'لن', 'ليس', 'مش', 'مو',
  'في', 'من', 'على', 'الى', 'عن', 'مع', 'بين',
  'هو', 'هي', 'هم', 'انا', 'نحن', 'انت', 'انتم', 'هن',
  'و', 'او', 'ان', 'اذا', 'ثم', 'بل', 'لكن', 'حتى',
  'هذا', 'هذه', 'ذلك', 'تلك', 'هاد', 'هيدا', 'هيدي',
  'كان', 'يكون', 'تكون', 'كانت', 'كانوا',
  'ال', 'الذي', 'التي', 'الذين',
  'قد', 'عند', 'بعد', 'قبل', 'كل', 'بعض', 'غير', 'فقط',
  'يا', 'يلي', 'اللي', 'شو', 'كيف', 'وين', 'ليش',
  'ب', 'ل', 'ف', 'ك',
]);

/** Normalize Arabic text for comparison */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0670]/g, '')   // diacritics
    .replace(/\u0640/g, '')                   // kashida
    .replace(/[إأآٱ]/g, 'ا')                 // alef variants
    .replace(/ة/g, 'ه')                      // taa marbuta
    .replace(/ى/g, 'ي')                      // alef maqsura
    .replace(/ؤ/g, 'و')                      // hamza waw
    .replace(/ئ/g, 'ي')                      // hamza ya
    .toLowerCase()
    .trim();
}

/** Tokenize query for analysis */
function tokenize(text: string): string[] {
  return normalizeArabic(text)
    .split(/[\s\-_.,;:!?()\[\]{}"'،؛؟]+/)
    .filter(t => t.length > 1 && !ARABIC_STOPWORDS.has(t));
}

// ─────────────────────────────────────────────────────────────────────
// Intent Detection Patterns
// ─────────────────────────────────────────────────────────────────────

const INTENT_PATTERNS: Record<Intent, RegExp[]> = {
  find_information: [
    /شو\s*(هو|هي|يعني)/i,
    /ما\s*(هو|هي|هي|معنى)/i,
    /عايز\s*(اعرف|افهم)/i,
    /بدي\s*(اعرف|افهم)/i,
    /اخبرني\s*عن/i,
    /وضحلي/i,
  ],
  calculate_salary: [
    /احسب.*راتب/i,
    /كم\s*راتب/i,
    /راتب.*كم/i,
    /قيمة\s*الراتب/i,
    /حساب\s*الراتب/i,
    /معاش.*شهري/i,
  ],
  calculate_pension: [
    /احسب.*معاش/i,
    /احسب.*تقاعد/i,
    /كم\s*معاشي/i,
    /معاش\s*تقاعدي/i,
    /راتب\s*تقاعدي/i,
    /حساب\s*المعاش/i,
  ],
  get_procedure: [
    /كيف\s*(اعمل|اقدم|احصل|اطلب)/i,
    /شو\s*(الخطوات|الاجراءات)/i,
    /اجراءات/i,
    /طريقة\s*(الحصول|التقديم|الطلب)/i,
    /خطوات/i,
  ],
  download_form: [
    /نموذج/i,
    /استمارة/i,
    /النموذج/i,
    /تحميل.*نموذج/i,
    /ت\d+/i, // form codes like ت2, ت11
    /طلب.*نموذج/i,
  ],
  compare_options: [
    /قارن/i,
    /الفرق\s*بين/i,
    /مقارنة/i,
    /افضل.*ام/i,
    /ايهما\s*افضل/i,
  ],
  retrieve_history: [
    /كان.*في\s*\d{4}/i,
    /سنة\s*\d{4}/i,
    /عام\s*\d{4}/i,
    /السابق/i,
    /تاريخ/i,
  ],
  request_action: [
    /اطلب/i,
    /اريد\s*طلب/i,
    /بدي\s*اطلب/i,
    /تقديم\s*طلب/i,
    /زيادة/i,
    /ترقية/i,
  ],
  check_eligibility: [
    /هل\s*يحق/i,
    /هل\s*استحق/i,
    /هل\s*يمكنني/i,
    /استحقاق/i,
    /شروط/i,
    /متطلبات/i,
  ],
  get_contact: [
    /رقم\s*(الهاتف|التليفون|الجوال)/i,
    /عنوان/i,
    /كيف\s*اتواصل/i,
    /للتواصل/i,
    /اتصل/i,
  ],
  clarify_previous: [
    /ما\s*فهمت/i,
    /مش\s*فاهم/i,
    /وضح.*اكتر/i,
    /اعد/i,
    /شو\s*يعني/i,
  ],
  greeting: [
    /^(صباح|مساء)\s*(الخير|النور)/i,
    /^مرحبا/i,
    /^اهلا/i,
    /^السلام\s*عليكم/i,
    /^هلا/i,
  ],
  complaint: [
    /شكوى/i,
    /مشكلة/i,
    /اشتكي/i,
    /غلط/i,
    /خطأ/i,
  ],
};

// ─────────────────────────────────────────────────────────────────────
// Entity Extraction Patterns
// ─────────────────────────────────────────────────────────────────────

const ENTITY_PATTERNS: Array<{ type: Entity['type']; pattern: RegExp; normalize?: (s: string) => string }> = [
  // Year patterns
  { type: 'year', pattern: /\b(19|20)\d{2}\b/g },
  { type: 'year', pattern: /سنة\s*(\d{4})/gi, normalize: (s) => s.replace(/سنة\s*/i, '') },
  { type: 'year', pattern: /عام\s*(\d{4})/gi, normalize: (s) => s.replace(/عام\s*/i, '') },
  
  // Amount patterns
  { type: 'amount', pattern: /\d+(?:,\d{3})*(?:\.\d+)?\s*(ليرة|دولار|L\.L\.|USD|\$)/gi },
  { type: 'amount', pattern: /(ليرة|دولار)\s*\d+(?:,\d{3})*(?:\.\d+)?/gi },
  
  // Rank patterns (Lebanese military)
  { type: 'rank', pattern: /(?:رتبة\s*)?(عميد|عقيد|مقدم|رائد|نقيب|ملازم\s*اول|ملازم|مساعد\s*اول|مساعد|رقيب\s*اول|رقيب|عريف|جندي)/gi },
  
  // Form code patterns
  { type: 'form_code', pattern: /ت\d+/gi },
  { type: 'form_code', pattern: /نموذج\s*(?:رقم\s*)?\d+/gi },
  
  // Document patterns
  { type: 'document', pattern: /(هوية|جواز\s*سفر|اخراج\s*قيد|شهادة|افادة|بطاقة)/gi },
  
  // Topic patterns
  { type: 'topic', pattern: /(راتب|معاش|تقاعد|اجازة|نقل|ترقية|تأمين|صحي|سكن|منحة|اعانة)/gi },
];

// ─────────────────────────────────────────────────────────────────────
// Query Understanding Engine
// ─────────────────────────────────────────────────────────────────────

export class QueryUnderstandingEngine {
  
  /**
   * Main entry point: analyze a query deeply
   */
  async understand(query: string, userId?: string): Promise<QueryUnderstanding> {
    const startTime = Date.now();
    
    // Normalize and tokenize
    const normalizedQuery = normalizeArabic(query);
    const queryTokens = tokenize(query);
    
    // Step 1: Detect language
    const language = this.detectLanguage(query);
    
    // Step 2: Extract intents
    const intents = this.detectIntents(query);
    const primaryIntent = intents[0] || 'find_information';
    const secondaryIntents = intents.slice(1);
    
    // Step 3: Determine query type
    const queryType = this.determineQueryType(primaryIntent, query);
    
    // Step 4: Extract entities
    const entities = this.extractEntities(query);
    
    // Step 5: Analyze temporal context
    const temporalContext = this.analyzeTemporalContext(query, entities);
    
    // Step 6: Assess complexity
    const complexity = this.assessComplexity(query, intents, entities, temporalContext);
    
    // Step 7: Detect implicit intents
    const implicitIntents = this.detectImplicitIntents(query, primaryIntent, entities);
    
    // Step 8: Check for ambiguities
    const ambiguities = this.detectAmbiguities(query, intents, entities);
    
    // Step 9: Calculate understanding confidence
    const understandingConfidence = this.calculateConfidence(intents, entities, ambiguities);
    
    return {
      originalQuery: query,
      normalizedQuery,
      language,
      primaryIntent,
      secondaryIntents,
      queryType,
      entities,
      temporalContext,
      complexity,
      requiresCalculation: this.needsCalculation(query, primaryIntent),
      requiresComparison: this.needsComparison(query),
      requiresMultipleSources: complexity === 'multi_hop' || complexity === 'complex',
      implicitIntents,
      understandingConfidence,
      ambiguities,
      queryTokens,
      processingTimeMs: Date.now() - startTime,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────
  // Internal methods
  // ─────────────────────────────────────────────────────────────────
  
  private detectLanguage(query: string): 'ar' | 'en' | 'mixed' {
    const arabicChars = (query.match(/[\u0600-\u06FF]/g) || []).length;
    const englishChars = (query.match(/[a-zA-Z]/g) || []).length;
    const total = arabicChars + englishChars;
    
    if (total === 0) return 'ar';
    if (arabicChars > englishChars * 2) return 'ar';
    if (englishChars > arabicChars * 2) return 'en';
    return 'mixed';
  }
  
  private detectIntents(query: string): Intent[] {
    const detected: Array<{ intent: Intent; score: number }> = [];
    
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS) as [Intent, RegExp[]][]) {
      let matches = 0;
      for (const pattern of patterns) {
        // Reset regex state for global patterns
        pattern.lastIndex = 0;
        if (pattern.test(query)) {
          matches++;
        }
      }
      if (matches > 0) {
        detected.push({ intent, score: matches });
      }
    }
    
    // Sort by score descending
    detected.sort((a, b) => b.score - a.score);
    
    // Return as array of intents
    if (detected.length === 0) {
      return ['find_information'];
    }
    
    return detected.map(d => d.intent);
  }
  
  private determineQueryType(primaryIntent: Intent, query: string): QueryType {
    if (primaryIntent === 'calculate_salary' || primaryIntent === 'calculate_pension') {
      return 'calculation';
    }
    if (primaryIntent === 'get_procedure') {
      return 'procedural';
    }
    if (primaryIntent === 'compare_options') {
      return 'analytical';
    }
    if (primaryIntent === 'greeting' || primaryIntent === 'clarify_previous') {
      return 'conversational';
    }
    return 'factual';
  }
  
  private extractEntities(query: string): Entity[] {
    const entities: Entity[] = [];
    
    for (const { type, pattern, normalize } of ENTITY_PATTERNS) {
      // Reset pattern for global matching
      pattern.lastIndex = 0;
      
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(query)) !== null) {
        const value = match[0];
        entities.push({
          type,
          value,
          normalized: normalize ? normalize(value) : value,
          position: { start: match.index, end: match.index + value.length },
        });
      }
    }
    
    // Deduplicate by normalized value
    const seen = new Set<string>();
    return entities.filter(e => {
      const key = `${e.type}:${e.normalized || e.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  private analyzeTemporalContext(query: string, entities: Entity[]): TemporalContext {
    const references: TemporalContext['references'] = [];
    
    // Check for year entities
    for (const e of entities) {
      if (e.type === 'year') {
        const year = parseInt(e.normalized || e.value, 10);
        const currentYear = new Date().getFullYear();
        
        references.push({
          type: year < currentYear ? 'past' : year === currentYear ? 'present' : 'future',
          value: e.value,
          year,
        });
      }
    }
    
    // Check for temporal keywords
    const pastKeywords = ['كان', 'السابق', 'قبل', 'ماضي'];
    const futureKeywords = ['سيكون', 'المقبل', 'القادم', 'بعد'];
    const presentKeywords = ['الآن', 'حالياً', 'اليوم'];
    
    for (const kw of pastKeywords) {
      if (query.includes(kw)) {
        references.push({ type: 'past', value: kw });
      }
    }
    for (const kw of futureKeywords) {
      if (query.includes(kw)) {
        references.push({ type: 'future', value: kw });
      }
    }
    for (const kw of presentKeywords) {
      if (query.includes(kw)) {
        references.push({ type: 'present', value: kw });
      }
    }
    
    return {
      hasTemporal: references.length > 0,
      references,
    };
  }
  
  private assessComplexity(
    query: string,
    intents: Intent[],
    entities: Entity[],
    temporal: TemporalContext
  ): ComplexityLevel {
    let complexityScore = 0;
    
    // Multiple intents = likely multi-hop
    if (intents.length > 1) {
      complexityScore += 2;
    }
    
    // Sequential keywords (ثم، بعد ذلك، و) indicate multi-step
    if (/ثم|بعد ذلك|ومن ثم/.test(query)) {
      complexityScore += 2;
    }
    
    // Comparison keywords
    if (/قارن|الفرق بين|مقارنة|ايهما/.test(query)) {
      complexityScore += 1;
    }
    
    // Multiple temporal references
    if (temporal.references.length > 1) {
      complexityScore += 1;
    }
    
    // Multiple entities of same type
    const entityTypeCounts = new Map<string, number>();
    for (const e of entities) {
      entityTypeCounts.set(e.type, (entityTypeCounts.get(e.type) || 0) + 1);
    }
    for (const count of entityTypeCounts.values()) {
      if (count > 1) complexityScore += 1;
    }
    
    // Long query
    if (query.length > 100) {
      complexityScore += 1;
    }
    
    // Determine level
    if (complexityScore >= 4) return 'multi_hop';
    if (complexityScore >= 2) return 'complex';
    if (complexityScore >= 1) return 'moderate';
    return 'simple';
  }
  
  private detectImplicitIntents(query: string, primaryIntent: Intent, entities: Entity[]): string[] {
    const implicit: string[] = [];
    
    // Asking about retirement → might want pension calculation
    if (primaryIntent === 'find_information' && /تقاعد|retire/i.test(query)) {
      implicit.push('calculate_pension');
      implicit.push('check_retirement_eligibility');
    }
    
    // Asking about salary → might need salary certificate
    if (primaryIntent === 'calculate_salary' || /راتب/i.test(query)) {
      implicit.push('download_salary_certificate');
    }
    
    // Has rank entity → might want rank-specific benefits
    if (entities.some(e => e.type === 'rank')) {
      implicit.push('rank_specific_benefits');
    }
    
    // Asking about forms → might need form instructions
    if (primaryIntent === 'download_form' || entities.some(e => e.type === 'form_code')) {
      implicit.push('form_instructions');
      implicit.push('required_documents');
    }
    
    return implicit;
  }
  
  private detectAmbiguities(query: string, intents: Intent[], entities: Entity[]): Ambiguity[] {
    const ambiguities: Ambiguity[] = [];
    
    // If query is too short and no clear intent
    if (query.length < 10 && intents.length === 0) {
      ambiguities.push({
        type: 'unclear_intent',
        description: 'Query too vague to understand intent',
        clarifyingQuestion: 'ممكن توضحلي أكتر شو بدك تعرف؟',
      });
    }
    
    // Multiple conflicting intents
    if (intents.length > 2) {
      ambiguities.push({
        type: 'unclear_intent',
        description: 'Multiple possible intents detected',
        clarifyingQuestion: 'بدك معلومات ولا بدك تعمل إجراء معين؟',
      });
    }
    
    // Missing required entity for some intents
    if ((intents.includes('calculate_salary') || intents.includes('calculate_pension')) 
        && !entities.some(e => e.type === 'rank')) {
      ambiguities.push({
        type: 'missing_entity',
        description: 'Rank required for salary calculation',
        clarifyingQuestion: 'شو رتبتك العسكرية؟',
      });
    }
    
    return ambiguities;
  }
  
  private calculateConfidence(intents: Intent[], entities: Entity[], ambiguities: Ambiguity[]): number {
    let confidence = 1.0;
    
    // No clear intents
    if (intents.length === 0 || intents[0] === 'find_information') {
      confidence *= 0.8;
    }
    
    // Ambiguities reduce confidence
    confidence *= Math.pow(0.85, ambiguities.length);
    
    // Having relevant entities boosts confidence
    if (entities.length > 0) {
      confidence *= 1.1; // Slightly boost
    }
    
    // Cap at 1.0
    return Math.min(1.0, confidence);
  }
  
  private needsCalculation(query: string, intent: Intent): boolean {
    return intent === 'calculate_salary' 
      || intent === 'calculate_pension'
      || /احسب|كم|مقدار|قيمة/.test(query);
  }
  
  private needsComparison(query: string): boolean {
    return /قارن|الفرق|مقارنة|افضل|ايهما/.test(query);
  }
}

// Singleton instance
export const queryUnderstanding = new QueryUnderstandingEngine();
