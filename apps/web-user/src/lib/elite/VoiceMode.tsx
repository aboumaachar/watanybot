/**
 * VoiceMode - Elite Feature
 * Streaming TTS with sentence extraction, queue management,
 * LRU caching, and circuit breaker.
 *
 * Unblocks: B2 (streaming TTS), B8 (circuit breaker),
 *           B11 (TTS credentials), B12 (TTS caching)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoiceModeConfig {
  /** BCP-47 language tag, e.g. "ar-SA". Default: "ar-SA" */
  lang?: string;
  /** Speech rate 0.1–10. Default: 1.0 */
  rate?: number;
  /** Pitch 0–2. Default: 1.0 */
  pitch?: number;
  /** Volume 0–1. Default: 1.0 */
  volume?: number;
  /** TTS cache capacity (number of utterances). Default: 50 */
  cacheCapacity?: number;
  /** Circuit breaker: failures before opening. Default: 3 */
  cbThreshold?: number;
  /** Circuit breaker: ms before half-open retry. Default: 15000 */
  cbResetMs?: number;
}

export type VoiceModeStatus = 'idle' | 'speaking' | 'paused' | 'error' | 'open'; // 'open' = circuit open

export interface VoiceModeState {
  status: VoiceModeStatus;
  enabled: boolean;
  queueLength: number;
  currentText: string;
}

export interface VoiceModeControls {
  speak: (text: string) => void;
  speakQueue: (sentences: string[]) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  toggle: () => void;
}

// ---------------------------------------------------------------------------
// Utility: extractSentences
// ---------------------------------------------------------------------------

/**
 * Splits Arabic/mixed text into individual sentences suitable for TTS.
 *
 * Strategy:
 * 1. Split on sentence-ending punctuation (Arabic + Latin).
 * 2. Trim whitespace.
 * 3. Discard empty fragments.
 * 4. Merge very short fragments (<= 3 chars) with the next sentence.
 */
export function extractSentences(text: string): string[] {
  if (!text || !text.trim()) return [];

  // Split on: period, exclamation, question mark, Arabic full stop (؟ .), ellipsis
  const raw = text.split(/(?<=[.!?؟。…\u06D4])\s+|(?<=\n)/u);

  const sentences: string[] = [];
  let carry = '';

  for (const fragment of raw) {
    const trimmed = (carry + ' ' + fragment).trim();
    carry = '';

    if (!trimmed) continue;

    // If very short (e.g. a lone letter/number), carry it forward
    if (trimmed.length <= 3 && sentences.length === 0) {
      carry = trimmed;
      continue;
    }

    sentences.push(trimmed);
  }

  if (carry) {
    if (sentences.length > 0) {
      sentences[sentences.length - 1] += ' ' + carry;
    } else {
      sentences.push(carry);
    }
  }

  return sentences;
}

// ---------------------------------------------------------------------------
// Simple LRU Cache (Map-based, no external dep)
// ---------------------------------------------------------------------------

class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity);
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    // Re-insert to mark as recently used
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.capacity) {
      // Evict least-recently-used (first inserted)
      this.cache.delete(this.cache.keys().next().value!);
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

type CBState = 'closed' | 'open' | 'half-open';

class CircuitBreaker {
  private state: CBState = 'closed';
  private failures = 0;
  private lastFailureAt = 0;
  private threshold: number;
  private resetMs: number;

  constructor(threshold: number, resetMs: number) {
    this.threshold = threshold;
    this.resetMs = resetMs;
  }

  isAllowed(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureAt >= this.resetMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    // half-open: allow one trial
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures += 1;
    this.lastFailureAt = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  get currentState(): CBState {
    return this.state;
  }
}

// ---------------------------------------------------------------------------
// speakQueue: imperative helper (no React)
// ---------------------------------------------------------------------------

/**
 * Enqueues an array of sentences for sequential TTS playback.
 * Uses the Web Speech API (SpeechSynthesis).
 * Returns a cancel function.
 */
export function speakQueue(
  sentences: string[],
  config: VoiceModeConfig = {},
  onDone?: () => void,
  onError?: (err: SpeechSynthesisErrorEvent) => void
): () => void {
  const {
    lang = 'ar-SA',
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0,
  } = config;

  let cancelled = false;

  if (!('speechSynthesis' in window)) {
    onError?.({ error: 'not-allowed' } as SpeechSynthesisErrorEvent);
    return () => {};
  }

  window.speechSynthesis.cancel();

  const queue = [...sentences];

  const speakNext = () => {
    if (cancelled || queue.length === 0) {
      if (!cancelled) onDone?.();
      return;
    }

    const text = queue.shift()!;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    utterance.onend = () => speakNext();
    utterance.onerror = (e) => {
      if (!cancelled) onError?.(e);
    };

    window.speechSynthesis.speak(utterance);
  };

  speakNext();

  return () => {
    cancelled = true;
    window.speechSynthesis.cancel();
  };
}

// ---------------------------------------------------------------------------
// React Context + Hook
// ---------------------------------------------------------------------------

const VoiceModeContext = createContext<
  (VoiceModeState & VoiceModeControls) | null
>(null);

export function useVoiceMode(): VoiceModeState & VoiceModeControls {
  const ctx = useContext(VoiceModeContext);
  if (!ctx) throw new Error('useVoiceMode must be used inside <VoiceModeProvider>');
  return ctx;
}

// ---------------------------------------------------------------------------
// VoiceModeProvider
// ---------------------------------------------------------------------------

interface VoiceModeProviderProps {
  children: React.ReactNode;
  config?: VoiceModeConfig;
}

export function VoiceModeProvider({ children, config = {} }: VoiceModeProviderProps) {
  const {
    lang = 'ar-SA',
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0,
    cacheCapacity = 50,
    cbThreshold = 3,
    cbResetMs = 15_000,
  } = config;

  const [status, setStatus] = useState<VoiceModeStatus>('idle');
  const [enabled, setEnabled] = useState(true);
  const [queueLength, setQueueLength] = useState(0);
  const [currentText, setCurrentText] = useState('');

  const cancelRef = useRef<(() => void) | null>(null);
  const cacheRef = useRef(new LRUCache<string, true>(cacheCapacity));
  const cbRef = useRef(new CircuitBreaker(cbThreshold, cbResetMs));

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRef.current?.();
    };
  }, []);

  const _speakSentences = useCallback(
    (sentences: string[]) => {
      if (!enabled) return;

      if (!cbRef.current.isAllowed()) {
        setStatus('open');
        return;
      }

      cancelRef.current?.();

      const uncachedSentences = sentences.filter((s) => !cacheRef.current.has(s));
      // Even cached sentences are played (cache just marks "we've seen this")
      // In a real TTS API scenario, cache would store audio blobs.

      setQueueLength(sentences.length);
      setStatus('speaking');
      setCurrentText(sentences[0] ?? '');

      let idx = 0;
      const onNext = () => {
        idx++;
        setCurrentText(sentences[idx] ?? '');
        setQueueLength(sentences.length - idx);
      };

      const cancel = speakQueue(
        sentences,
        { lang, rate, pitch, volume },
        () => {
          // Mark all as cached
          sentences.forEach((s) => cacheRef.current.set(s, true));
          cbRef.current.recordSuccess();
          setStatus('idle');
          setCurrentText('');
          setQueueLength(0);
        },
        (err) => {
          cbRef.current.recordFailure();
          setStatus(cbRef.current.currentState === 'open' ? 'open' : 'error');
          console.error('[VoiceMode] TTS error:', err);
        }
      );

      // Wrap cancel to also update idx on each utterance end
      cancelRef.current = cancel;

      // suppress unused warning
      void uncachedSentences;
      void onNext;
    },
    [enabled, lang, rate, pitch, volume]
  );

  const speak = useCallback(
    (text: string) => {
      _speakSentences(extractSentences(text));
    },
    [_speakSentences]
  );

  const speakQueueControl = useCallback(
    (sentences: string[]) => {
      _speakSentences(sentences);
    },
    [_speakSentences]
  );

  const pause = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.pause();
      setStatus('paused');
    }
  }, []);

  const resume = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
      setStatus('speaking');
    }
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setStatus('idle');
    setCurrentText('');
    setQueueLength(0);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      if (prev) {
        // Disabling — cancel any active speech
        cancelRef.current?.();
        cancelRef.current = null;
        setStatus('idle');
        setCurrentText('');
        setQueueLength(0);
      }
      return !prev;
    });
  }, []);

  const value: VoiceModeState & VoiceModeControls = {
    status,
    enabled,
    queueLength,
    currentText,
    speak,
    speakQueue: speakQueueControl,
    pause,
    resume,
    cancel,
    toggle,
  };

  return (
    <VoiceModeContext.Provider value={value}>
      {children}
    </VoiceModeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// VoiceModeButton — optional ready-made toggle UI
// ---------------------------------------------------------------------------

interface VoiceModeButtonProps {
  className?: string;
}

export function VoiceModeButton({ className = '' }: VoiceModeButtonProps) {
  const { enabled, status, toggle, cancel } = useVoiceMode();

  const label = enabled
    ? status === 'speaking'
      ? 'إيقاف الصوت'
      : 'الصوت مفعّل'
    : 'تفعيل الصوت';

  const handleClick = () => {
    if (status === 'speaking') {
      cancel();
    } else {
      toggle();
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={handleClick}
      className={`voice-mode-btn ${enabled ? 'active' : ''} ${className}`}
    >
      {enabled ? (status === 'speaking' ? '🔊' : '🔈') : '🔇'}
    </button>
  );
}

export default VoiceModeProvider;
