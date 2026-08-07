/**
 * Elite Features Index
 * Export all elite features for easy importing
 */

// User Profiling
export { userProfiling } from './user-profiling';
export type {
  UserProfile,
  UserDemographics,
  PersonalityTraits,
  BehaviorPatterns,
  UserPreferences,
  UserInterests,
  LifeEvent,
  Interaction,
  SentimentResult,
} from './user-profiling';

// Emotional AI
export { emotionalAI } from './emotional-ai';
export type {
  EmotionalState,
  CrisisAssessment,
  CrisisResource,
} from './emotional-ai';

// Voice Commands
export { voiceCommands, getVoiceCommandsHelp } from './voice-commands';
export type { VoiceCommand, VoiceCommandResult } from './voice-commands';

// Voice Mode (TTS streaming, queue, cache, circuit breaker)
export {
  extractSentences,
  speakQueue,
  useVoiceMode,
  VoiceModeProvider,
  VoiceModeButton,
} from './VoiceMode';
export type { VoiceModeConfig, VoiceModeState, VoiceModeControls, VoiceModeStatus } from './VoiceMode';
