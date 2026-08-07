/**
 * Voice Commands System - Elite Feature
 * Navigation and actions via voice commands
 * Based on WATANYBOT_ELITE_VISION.md specification
 */

export interface VoiceCommand {
  patterns: string[];
  action: string;
  type: 'navigation' | 'action' | 'query';
}

export interface VoiceCommandResult {
  matched: boolean;
  command?: VoiceCommand;
  action?: string;
  params?: Record<string, string>;
}

// Navigation commands
const NAVIGATION_COMMANDS: VoiceCommand[] = [
  {
    patterns: ['افتح حاسبة الرواتب', 'حاسبة الرواتب', 'بدي احسب راتبي', 'حساب المعاش'],
    action: 'navigate:/salary',
    type: 'navigation',
  },
  {
    patterns: ['أرني المعاملات', 'المعاملات', 'قائمة المعاملات', 'فتح المعاملات', 'أرني الإجراءات', 'الإجراءات', 'قائمة الإجراءات', 'فتح الإجراءات', 'النماذج'],
    action: 'navigate:/procedures',
    type: 'navigation',
  },
  {
    patterns: ['المعاملات', 'تصفح المعاملات', 'شو المعاملات', 'الإجراءات'],
    action: 'navigate:/procedures',
    type: 'navigation',
  },
  {
    patterns: ['البحث', 'بدي ابحث', 'فتح البحث'],
    action: 'navigate:/search',
    type: 'navigation',
  },
  {
    patterns: ['الملاحظات', 'الإشعارات', 'التنبيهات'],
    action: 'navigate:/notifications',
    type: 'navigation',
  },
  {
    patterns: ['الوظائف', 'فرص العمل', 'شغل'],
    action: 'navigate:/jobs',
    type: 'navigation',
  },
  {
    patterns: ['التطويع', 'إعلانات التطويع', 'تجنيد', 'مباراة تطويع'],
    action: 'navigate:/services/recruitment',
    type: 'navigation',
  },
  {
    patterns: ['السوق', 'الماركت', 'بيع وشراء'],
    action: 'navigate:/marketplace',
    type: 'navigation',
  },
  {
    patterns: ['ملفي الشخصي', 'بروفايل', 'معلوماتي'],
    action: 'navigate:/profile',
    type: 'navigation',
  },
  {
    patterns: ['الوثائق', 'المستندات', 'أوراقي'],
    action: 'navigate:/documents',
    type: 'navigation',
  },
  {
    patterns: ['الصفحة الرئيسية', 'الرئيسية', 'البداية'],
    action: 'navigate:/chat',
    type: 'navigation',
  },
  {
    patterns: ['ارجع', 'رجوع', 'للخلف'],
    action: 'history:back',
    type: 'navigation',
  },
];

// Action commands
const ACTION_COMMANDS: VoiceCommand[] = [
  {
    patterns: ['أرسل الطلب', 'إرسال', 'تأكيد'],
    action: 'submit:form',
    type: 'action',
  },
  {
    patterns: ['اطبع', 'طباعة', 'بدي اطبع'],
    action: 'print:page',
    type: 'action',
  },
  {
    patterns: ['شارك', 'مشاركة', 'بدي شارك'],
    action: 'share:page',
    type: 'action',
  },
  {
    patterns: ['مساعدة', 'عون', 'شو الخيارات'],
    action: 'help:show',
    type: 'action',
  },
  {
    patterns: ['وقف', 'إلغاء', 'ستوب'],
    action: 'cancel:current',
    type: 'action',
  },
];

// Query commands (will be passed to chat)
const QUERY_COMMANDS: VoiceCommand[] = [
  {
    patterns: ['ما راتبي', 'شو راتبي', 'كم راتبي'],
    action: 'query:salary',
    type: 'query',
  },
  {
    patterns: ['متى أتقاعد', 'موعد التقاعد', 'كم بقي للتقاعد'],
    action: 'query:retirement',
    type: 'query',
  },
  {
    patterns: ['كم إجازة متبقية', 'رصيد الإجازات', 'إجازاتي'],
    action: 'query:leave_balance',
    type: 'query',
  },
  {
    patterns: ['أين أقرب مستشفى', 'مستشفى قريب', 'بدي مستشفى'],
    action: 'query:nearest_hospital',
    type: 'query',
  },
];

const ALL_COMMANDS = [...NAVIGATION_COMMANDS, ...ACTION_COMMANDS, ...QUERY_COMMANDS];

/**
 * Voice Commands Engine
 */
class VoiceCommandsEngine {
  /**
   * Match voice input against commands
   */
  matchCommand(input: string): VoiceCommandResult {
    const normalized = this.normalizeInput(input);

    for (const command of ALL_COMMANDS) {
      for (const pattern of command.patterns) {
        const normalizedPattern = this.normalizeInput(pattern);
        
        // Exact match
        if (normalized === normalizedPattern) {
          return { matched: true, command, action: command.action };
        }
        
        // Contains match
        if (normalized.includes(normalizedPattern)) {
          return { matched: true, command, action: command.action };
        }
        
        // Fuzzy match (allow some variation)
        if (this.fuzzyMatch(normalized, normalizedPattern)) {
          return { matched: true, command, action: command.action };
        }
      }
    }

    return { matched: false };
  }

  /**
   * Normalize input text
   */
  private normalizeInput(text: string): string {
    return text
      .toLowerCase()
      .trim()
      // Remove diacritics
      .replace(/[\u064B-\u065F]/g, '')
      // Normalize Arabic characters
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');
  }

  /**
   * Fuzzy matching for close matches
   */
  private fuzzyMatch(input: string, pattern: string): boolean {
    // Simple Levenshtein-like check: if more than 80% of pattern words exist in input
    const patternWords = pattern.split(/\s+/);
    const inputWords = input.split(/\s+/);
    
    let matches = 0;
    for (const pw of patternWords) {
      if (inputWords.some(iw => iw.includes(pw) || pw.includes(iw))) {
        matches++;
      }
    }
    
    return matches / patternWords.length >= 0.7;
  }

  /**
   * Execute a matched command
   */
  executeCommand(result: VoiceCommandResult, navigate: (path: string) => void): boolean {
    if (!result.matched || !result.action) return false;

    const [type, value] = result.action.split(':');

    switch (type) {
      case 'navigate':
        navigate(value);
        return true;
      
      case 'history':
        if (value === 'back') {
          globalThis.history.back();
        }
        return true;
      
      case 'print':
        globalThis.print();
        return true;
      
      case 'share':
        if (navigator.share) {
          navigator.share({
            title: 'موطني',
            url: globalThis.location.href,
          });
        }
        return true;
      
      case 'help':
        // Show help modal - handled by caller
        return false;
      
      case 'query':
        // Return false to let the query be handled by chat
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Get all available voice commands
   */
  getAllCommands(): VoiceCommand[] {
    return ALL_COMMANDS;
  }

  /**
   * Get commands by type
   */
  getCommandsByType(type: 'navigation' | 'action' | 'query'): VoiceCommand[] {
    return ALL_COMMANDS.filter(c => c.type === type);
  }

  /**
   * Get voice command suggestions
   */
  getSuggestions(): string[] {
    return [
      'افتح حاسبة الرواتب',
      'أرني النماذج',
      'ما راتبي',
      'متى أتقاعد',
      'أرني المعاملات',
      'مساعدة',
    ];
  }
}

// Singleton instance
export const voiceCommands = new VoiceCommandsEngine();

/**
 * Voice Command Help Component Data
 */
export function getVoiceCommandsHelp(): { category: string; commands: string[] }[] {
  return [
    {
      category: 'التنقل',
      commands: [
        'افتح حاسبة الرواتب',
        'أرني النماذج',
        'أرني المعاملات',
        'الصفحة الرئيسية',
        'ارجع',
      ],
    },
    {
      category: 'المعاملات',
      commands: [
        'أرسل الطلب',
        'اطبع',
        'شارك',
        'مساعدة',
      ],
    },
    {
      category: 'الاستفسارات',
      commands: [
        'ما راتبي',
        'متى أتقاعد',
        'كم إجازة متبقية',
        'أين أقرب مستشفى',
      ],
    },
  ];
}
