/**
 * VoiceMode v2  Elderly-friendly full-screen voice assistant
 *
 * Design principles (users are 60+ year-old veterans):
 *  1. ONE giant central ORB  tap to talk, tap to stop
 *  2. Very large text, high contrast, zero clutter
 *  3. Clear color-coded states (grey=ready, blue=listening, purple=thinking, green=speaking)
 *  4. Auto-continuous mode ON by default  bot responds then auto-listens
 *  5. SpeechRecognition network fallback   server STT (Whisper)
 *  6. Progressive sentence-by-sentence TTS
 *  7. Uses CSS classes from styles.css (vc-* prefix)
 */
/* (sonarjs rule disabled in project config) */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Hourglass24Regular,
  Mic24Regular,
  Speaker224Regular,
  Stop24Regular,
  Warning24Regular,
} from "../theme/watany-v4/legacyIconBridge";
import { MainHybridChatSurface } from "./chat/MainHybridChatSurface";
import { useApp } from "../store/app";
import { getDefaultApiBaseUrl } from "../lib/api-base";
import { fixMojibake } from "../lib/encoding";

/*  Constants  */
const GATEWAY = () => getDefaultApiBaseUrl();
const SILENCE_MS = 3200;      // allow a slightly longer pause before auto-send
const VOICE_THRESH = 0.006;   // lower RMS threshold so quieter speech is detected
const MAX_LISTEN_MS = 20_000; // max 20s listening
const MIN_RECORD_MS = 350;    // accept shorter utterances

type Phase = "idle" | "listening" | "thinking" | "speaking" | "error";

interface Msg {
  id: number;
  role: "user" | "bot";
  text: string;
}

interface VoiceProviderState {
  effectiveProvider: string;
  configuredProvider?: string;
  strictProvider?: boolean;
}

let _id = 0;

export function VoiceMode({ onClose }: Readonly<{ onClose: () => void }>) {
  const { lang, channel, apiBaseUrl } = useApp();
  const GW = apiBaseUrl || GATEWAY();

  /*  State  */
  const [phase, setPhase] = useState<Phase>("idle");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [statusText, setStatusText] = useState("اضغط الزر للتكلم");
  const [statusHint, setStatusHint] = useState("أنا جاهز لأسمعك");
  const [liveText, setLiveText] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [continuous, setContinuous] = useState(true);
  const [micError, setMicError] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState<VoiceProviderState>({ effectiveProvider: "adaptive" });

  /*  Refs  */
  const mountedRef = useRef(true);
  const phaseRef = useRef<Phase>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const speechRecRef = useRef<any>(null);
  const vadRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognizedRef = useRef("");
  const continuousRef = useRef(true);
  const volumeRef = useRef(0.85);
  const recordStartRef = useRef(0);
  const stoppedByUserRef = useRef(false);
  const chunksRef = useRef<Blob[]>([]);
  const srFailedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /*  Keep refs in sync  */
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { continuousRef.current = continuous; }, [continuous]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  /*  Auto-scroll messages  */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  /*  Mount/unmount  */
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; doCleanup(); };
  }, []);

  const refreshVoiceProvider = useCallback(async () => {
    try {
      const res = await fetch(`${GW}/api/voice/health`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return;
      const data = await res.json();
      const tts = data?.tts || {};
      const effectiveProvider = String(tts.provider || "adaptive").toLowerCase();
      const configuredProvider = tts.configuredProvider ? String(tts.configuredProvider).toLowerCase() : undefined;
      setVoiceProvider({
        effectiveProvider,
        configuredProvider,
        strictProvider: !!tts.strictProvider,
      });
    } catch {
      // Keep a neutral label if health probing fails.
    }
  }, [GW]);

  useEffect(() => {
    void refreshVoiceProvider();
  }, [refreshVoiceProvider]);

  /*  Cleanup  */
  function doCleanup() {
    try { recorderRef.current?.stop(); } catch {}
    try { speechRecRef.current?.abort(); } catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    try { audioRef.current?.pause(); } catch {}
    if (vadRef.current) cancelAnimationFrame(vadRef.current);
    recorderRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    speechRecRef.current = null;
    audioRef.current = null;
  }

  

  function getVoiceProviderLabel() {
    const provider = voiceProvider.effectiveProvider || "adaptive";
    if (provider === "openai") return "OpenAI Voice";
    if (provider === "azure") return "Azure Voice";
    if (provider === "voicerss") return "VoiceRSS";
    if (provider === "google") return "Google Voice";
    return "Adaptive Voice";
  }

  /* """"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
     SEND TEXT   GATEWAY   TTS
     """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""" */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function doSend(text: string) {
    if (!text.trim()) return;
    if (phaseRef.current === "thinking" || phaseRef.current === "speaking") return;

    const userMsg: Msg = { id: ++_id, role: "user", text };
    setMsgs(prev => [...prev, userMsg]);
    setPhase("thinking");
    setStatusText("أفكر في الإجابة...");
    setStatusHint("لحظة من فضلك");
    setLiveText("");
    void refreshVoiceProvider();

    try {
      let reply = "";
      try {
        reply = await fetchStream(text);
      } catch {
        reply = await fetchPlain(text);
      }
      if (!reply) reply = "عذرا، لم أتمكن من الإجابة حاليا.";

      const botMsg: Msg = { id: ++_id, role: "bot", text: reply };
      if (!mountedRef.current) return;
      setMsgs(prev => [...prev, botMsg]);
      setPhase("speaking");
      setStatusText("أتكلم...");
      setStatusHint("اضغط الزر للإيقاف");

      // Progressive sentence-by-sentence TTS
      const sentences = reply
        .replace(/```[\s\S]*?```/g, "")
        .replace(/[#*_~`]/g, "")
        .replace(/\n+/g, " ")
        .trim()
        .split(/(?<=[.!؟?])\s+/)
        .filter(s => s.trim());

      for (const sentence of sentences) {
        if (!mountedRef.current || (phaseRef.current as Phase) !== "speaking") break;
        await doSpeak(sentence.trim().slice(0, 1000));
      }
    } catch {
      if (!mountedRef.current) return;
      setMsgs(prev => [...prev, { id: ++_id, role: "bot", text: "حدث خطأ. حاول مرة ثانية." }]);
    } finally {
      if (!mountedRef.current) return;
      setPhase("idle");
      setStatusText("اضغط الزر للتكلم");
      setStatusHint("أنا جاهز لأسمعك");
      setLiveText("");
      audioRef.current = null;

      // Auto-listen in continuous mode
      if (continuousRef.current && !stoppedByUserRef.current) {
        setTimeout(() => {
          if (mountedRef.current && phaseRef.current === "idle" && continuousRef.current) {
            startMic();
          }
        }, 700);
      }
    }
  }

  /*  Stream fetch (SSE)  */
  async function fetchStream(text: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch(`${GW}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, channel, lang: lang || "ar", voiceMode: true }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("stream-fail");

      const reader = res.body.getReader();
      const dec = new TextDecoder("utf-8");
      let buf = "", full = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("/n/n");
        buf = parts.pop() || "";
        for (const part of parts) {
          if (part.startsWith(":")) continue;
          let ev = "message", data = "";
          for (const line of part.split("/n")) {
            if (line.startsWith("event:")) ev = line.slice(6).trim();
            if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;
          try {
            const j = JSON.parse(data);
            if (ev === "delta" && j.delta) {
              full += fixMojibake(j.delta);
              if (mountedRef.current) setLiveText(full.slice(-100));
            }
            if (ev === "meta" && j.reply) full = fixMojibake(j.reply);
          } catch {}
        }
      }
      return full;
    } finally {
      clearTimeout(timeout);
    }
  }

  /*  Plain fetch (fallback)  */
  async function fetchPlain(text: string): Promise<string> {
    const res = await fetch(`${GW}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, channel, lang: lang || "ar" }),
      signal: AbortSignal.timeout(90_000),
    });
    const j = await res.json();
    return fixMojibake(j.reply || j.answer || "");
  }

  /*  TTS (single sentence)  */
  async function doSpeak(text: string) {
    if (!text.trim()) return;
    try {
      const res = await fetch(`${GW}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speed: 0.9, lang: lang || "ar" }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      await new Promise<void>(resolve => {
        const audio = new Audio(url);
        audio.volume = volumeRef.current;
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => resolve());
      });
    } catch {}
  }

  /*  Stop speaking  */
  function stopSpeaking() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    globalThis.speechSynthesis?.cancel();
  }

  /* """"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
     SERVER STT  fallback when SpeechRecognition has no network
     """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""" */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function serverSTT(): Promise<string> {
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      if (blob.size < 1000) return "";
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // Convert to base64 in chunks to avoid call stack overflow
      let b64 = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        b64 += String.fromCodePoint(...bytes.subarray(i, i + chunk));
      }
      b64 = btoa(b64);

      const res = await fetch(`${GW}/api/stt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: b64, mime: "audio/webm", language: lang || "ar" }),
      });
      if (!res.ok) return "";
      const j = await res.json();
      return (j.text || "").trim();
    } catch {
      return "";
    }
  }

  /* """"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
     UNIFIED VOICE CHAT  single round-trip: audio   STT+Chat+TTS
     Used when browser SpeechRecognition is unavailable.
     """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""" */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function doSendUnified() {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size < 1000) return false;

    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let b64 = "";
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      b64 += String.fromCodePoint(...bytes.subarray(i, i + chunk));
    }
    b64 = btoa(b64);

    if (!mountedRef.current) return false;
    setPhase("thinking");
    setStatusText("أحلل الصوت وأجيب...");
    setStatusHint("لحظة من فضلك");
    void refreshVoiceProvider();

    try {
      const res = await fetch(`${GW}/api/voice/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: b64,
          mime: "audio/webm;codecs=opus",
          lang: lang || "ar",
          channel,
        }),
        signal: AbortSignal.timeout(90_000),
      });

      if (!res.ok) return false;
      const data = await res.json();
      if (!data.ok || !data.transcript) return false;

      if (data.meta?.ttsProvider) {
        const effectiveProvider = String(data.meta.ttsProvider).toLowerCase();
        setVoiceProvider(prev => ({
          effectiveProvider,
          configuredProvider: prev.configuredProvider,
          strictProvider: prev.strictProvider,
        }));
      }

      if (!mountedRef.current) return true;

      // Show user transcript
      setMsgs(prev => [...prev, { id: ++_id, role: "user", text: data.transcript }]);

      // Show bot reply
      const reply = fixMojibake(data.reply || "");
      setMsgs(prev => [...prev, { id: ++_id, role: "bot", text: reply }]);
      setPhase("speaking");
      setStatusText("أتكلم...");
      setStatusHint("اضغط الزر للإيقاف");

      // Play audio from unified response if available
      if (data.audio?.base64) {
        try {
          const audioBytes = Uint8Array.from(atob(data.audio.base64), (c) => c.codePointAt(0) ?? 0);
          const audioBlob = new Blob([audioBytes], { type: data.audio.mimeType || "audio/mpeg" });
          const url = URL.createObjectURL(audioBlob);
          await new Promise<void>(resolve => {
            const audio = new Audio(url);
            audio.volume = volumeRef.current;
            audioRef.current = audio;
            audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
            audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
            audio.play().catch(() => resolve());
          });
        } catch {
          // Fallback: speak sentences individually via /api/tts
          const sentences = reply.replace(/[#*_~`]/g, "").replace(/\n+/g, " ").trim()
            .split(/(?<=[.!؟?])\s+/).filter(s => s.trim());
          for (const sentence of sentences) {
            if (!mountedRef.current || phaseRef.current !== "speaking") break;
            await doSpeak(sentence.trim().slice(0, 1000));
          }
        }
      } else {
        // No audio in response  use sentence-by-sentence TTS
        const sentences = reply.replace(/[#*_~`]/g, "").replace(/\n+/g, " ").trim()
          .split(/(?<=[.!؟?])\s+/).filter(s => s.trim());
        for (const sentence of sentences) {
          if (!mountedRef.current || phaseRef.current !== "speaking") break;
          await doSpeak(sentence.trim().slice(0, 1000));
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /* """"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
     MICROPHONE  Start recording + VAD + SpeechRecognition
     """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""" */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startMic = useCallback(async () => {
    if (phaseRef.current !== "idle") return;
    stoppedByUserRef.current = false;
    srFailedRef.current = false;
    chunksRef.current = [];
    recognizedRef.current = "";
    setMicError("");
    setLiveText("");
    setPhase("listening");
    setStatusText("أسمعك... تكلم الآن");
    setStatusHint("تكلم على راحتك حتى لو كان صوتك منخفضا");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
        },
      });
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;

      // AudioContext for VAD
      const ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.18;
      src.connect(analyser);

      // MediaRecorder  always captures audio for server STT fallback
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        await ctx.close().catch(() => undefined);
        try { speechRecRef.current?.abort(); } catch {}
        speechRecRef.current = null;

        const elapsed = Date.now() - recordStartRef.current;
        if (elapsed < MIN_RECORD_MS) {
          if (mountedRef.current) {
            setPhase("idle");
            setStatusText("اضغط الزر للتكلم");
            setStatusHint("التسجيل كان قصيرا. حاول مرة ثانية");
          }
          return;
        }

        let text = recognizedRef.current.trim();

        // If browser SpeechRecognition failed, try unified voice endpoint (STT+Chat+TTS in one trip)
        if (!text && chunksRef.current.length > 0) {
          if (mountedRef.current) {
            setStatusText("أحلل الصوت الآن...");
            setStatusHint("لحظة");
            setPhase("thinking");
          }
          const unified = await doSendUnified();
          if (unified) {
            // Unified endpoint handled everything  skip doSend
            if (mountedRef.current) {
              setPhase("idle");
              setStatusText("اضغط الزر للتكلم");
              setStatusHint("أنا جاهز لأسمعك");
              if (continuousRef.current && !stoppedByUserRef.current) {
                setTimeout(() => {
                  if (mountedRef.current && phaseRef.current === "idle" && continuousRef.current) startMic();
                }, 700);
              }
            }
            return;
          }
          // Unified failed  fallback to separate STT
          text = await serverSTT();
        }

        if (text && mountedRef.current) {
          doSend(text);
        } else if (mountedRef.current) {
          setPhase("idle");
          setStatusText("لم أسمع شيئا");
          setStatusHint("حاول مرة ثانية وتكلم بوضوح");
          if (continuousRef.current && !stoppedByUserRef.current) {
            setTimeout(() => {
              if (mountedRef.current && phaseRef.current === "idle" && continuousRef.current) startMic();
            }, 2500);
          }
        }
      };

      // SpeechRecognition  live text with graceful degradation
      const speechWindow = globalThis as typeof globalThis & {
        SpeechRecognition?: new () => any;
        webkitSpeechRecognition?: new () => any;
      };
      const SR = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
      if (SR) {
        const sr = new SR();
        sr.lang = "ar-LB";
        sr.interimResults = true;
        sr.continuous = true;
        sr.maxAlternatives = 1;
        let networkErrors = 0;

        sr.onresult = (e: any) => {
          networkErrors = 0;
          let interim = "", final = "";
          for (const r of e.results as Iterable<any>) {
            if (r.isFinal) final += r[0].transcript + " ";
            else interim += r[0].transcript;
          }
          const combined = (final + interim).trim();
          recognizedRef.current = combined;
          if (combined && mountedRef.current) {
            setLiveText(combined);
            setStatusHint("أسمعك...");
          }
        };

        sr.onerror = (e: any) => {
          const err = e?.error || "unknown";
          if (err === "network") {
            networkErrors++;
            if (networkErrors >= 2) {
              srFailedRef.current = true;
              try { sr.abort(); } catch {}
              speechRecRef.current = null;
              // Graceful: just note we'll use server STT  NO scary error
              if (mountedRef.current) {
                setStatusHint("أسجل الصوت...");
              }
            }
          } else if (err === "not-allowed") {
            try { sr.abort(); } catch {}
            speechRecRef.current = null;
          }
        };

        sr.onend = () => {
          if (networkErrors >= 2) return;
          if (recorderRef.current?.state === "recording" && mountedRef.current) {
            try { sr.start(); } catch {}
          }
        };

        speechRecRef.current = sr;
        try { sr.start(); } catch {}
      } else {
        srFailedRef.current = true;
      }

      rec.start(250);
      recordStartRef.current = Date.now();

      // VAD  auto-stop after silence
      let lastVoice = Date.now();
      let heardVoice = false;
      const data = new Float32Array(analyser.fftSize);

      function runVAD() {
        if (!mountedRef.current || rec.state !== "recording") return;
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (const value of data) sum += value * value;
        const rms = Math.sqrt(sum / data.length);
        if (mountedRef.current) setAudioLevel(Math.min(1, rms * 8));

        if (rms > VOICE_THRESH) {
          heardVoice = true;
          lastVoice = Date.now();
        }

        if (heardVoice && Date.now() - lastVoice > SILENCE_MS) {
          rec.stop();
          return;
        }
        if (Date.now() - recordStartRef.current > MAX_LISTEN_MS) {
          rec.stop();
          return;
        }
        vadRef.current = requestAnimationFrame(runVAD);
      }
      vadRef.current = requestAnimationFrame(runVAD);

    } catch (err: any) {
      if (!mountedRef.current) return;
      setPhase("error");
      const errName = err?.name || "";
      if (errName === "NotAllowedError") {
        setMicError("الميكروفون محجوب. اسمح له من إعدادات المتصفح");
      } else if (errName === "NotFoundError") {
        setMicError("لم يتم العثور على ميكروفون. وصل واحدا ثم حاول");
      } else {
        setMicError("مشكلة في الميكروفون. حاول مرة ثانية");
      }
      setStatusText("مشكلة في التسجيل");
      setStatusHint("");
      setTimeout(() => {
        if (mountedRef.current && phaseRef.current === "error") {
          setPhase("idle");
          setStatusText("اضغط الزر للتكلم");
          setStatusHint("أنا جاهز لأسمعك");
          setMicError("");
        }
      }, 5000);
    }
  }, [doSend, doSendUnified, serverSTT]);

  /*  Stop mic  */
  function stopMic() {
    stoppedByUserRef.current = true;
    try { recorderRef.current?.stop(); } catch {}
  }

  /*  Main orb action  */
  function onOrbPress() {
    if (phase === "listening") {
      stopMic();
    } else if (phase === "speaking") {
      stopSpeaking();
      setPhase("idle");
      setStatusText("اضغط الزر للتكلم");
      setStatusHint("أنا جاهز لأسمعك");
    } else if (phase === "idle" || phase === "error") {
      startMic();
    }
  }

  /*  Close  */
  function handleClose() {
    doCleanup();
    onClose();
  }

  /*  Phase-dependent orb class  */
  let orbMod = "vc-orb--idle";
  let orbIconEl = <Mic24Regular aria-hidden />;
  if (phase === "listening") {
    orbMod = "vc-orb--listening";
    orbIconEl = <Stop24Regular aria-hidden />;
  } else if (phase === "thinking") {
    orbMod = "vc-orb--thinking";
    orbIconEl = <Hourglass24Regular aria-hidden />;
  } else if (phase === "speaking") {
    orbMod = "vc-orb--speaking";
    orbIconEl = <Speaker224Regular aria-hidden />;
  } else if (phase === "error") {
    orbMod = "vc-orb--error";
    orbIconEl = <Warning24Regular aria-hidden />;
  }

  const orbScale = phase === "listening" ? 1 + audioLevel * 0.2 : 1;

  return (
    <div className="vc-overlay" dir="rtl">
      {/*  Close button  */}
      <button className="vc-close" onClick={handleClose} aria-label="إغلاق">✕</button>

      {/*  Title  */}
      <div className="vc-title">محادثة صوتية</div>
      <div className="vc-subtitle">الردود تُولّد عبر الذكاء الاصطناعي وتُقرأ صوتيا مع بدائل تلقائية عند الحاجة.</div>

      {/*  Messages area  */}
      <div className="vc-messages" ref={scrollRef}>
      <MainHybridChatSurface context="components/VoiceMode.tsx" />
        {msgs.length === 0 && (
          <div className="vc-empty">
            <div className="vc-empty-icon"><Mic24Regular aria-hidden style={{ fontSize: '2rem' }} /></div>
            <div className="vc-empty-text">اضغط على الزر الكبير للتكلم</div>
            <div className="vc-empty-hint">سأسمعك وأجيبك بالصوت</div>
          </div>
        )}
        {msgs.map(m => (
          <div key={m.id} className={`vc-msg vc-msg--${m.role}`}>
            <div className="vc-msg-label">{m.role === "user" ? "أنت" : "موطني"}</div>
            <div className="vc-msg-text">{m.text}</div>
          </div>
        ))}
        {phase === "thinking" && liveText && (
          <div className="vc-msg vc-msg--bot">
            <div className="vc-msg-label">موطني</div>
            <div className="vc-msg-text vc-typing">{liveText}...</div>
          </div>
        )}
      </div>

      {/*  Mic error banner  */}
      {micError && <div className="vc-error-banner">{micError}</div>}

      {/*  Bottom area: status + orb + controls  */}
      <div className="vc-bottom">
        {/* Live transcription */}
        {phase === "listening" && liveText && (
          <div className="vc-live-text">«{liveText}»</div>
        )}

        {/* Status text */}
        <div className="vc-status">
          <div className="vc-status-main">{statusText}</div>
          {statusHint && <div className="vc-status-hint">{statusHint}</div>}
          <div className="vc-status-provider">
            <Mic24Regular aria-hidden />
            <span>{getVoiceProviderLabel()}</span>
          </div>
        </div>

        {/*  Giant orb button  */}
        <div className="vc-orb-wrap">
          {phase === "listening" && (
            <>
              <div className="vc-ring vc-ring--1" />
              <div className="vc-ring vc-ring--2" />
              <div className="vc-ring vc-ring--3" />
            </>
          )}
          <button
            className={`vc-orb ${orbMod}`}
            onClick={onOrbPress}
            disabled={phase === "thinking"}
            style={{ transform: `scale(${orbScale})` }}
            aria-label={phase === "listening" ? "إيقاف التسجيل" : "ابدأ التسجيل"}
          >
            <span className="vc-orb-icon">{orbIconEl}</span>
          </button>
        </div>

        {/*  Controls row  */}
        <div className="vc-controls">
          {/* Volume slider */}
          <div className="vc-vol-row">
            <span className="vc-vol-icon"><Speaker224Regular aria-hidden /></span>
            <input
              type="range" min={0} max={1} step={0.05}
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="vc-vol-slider"
            />
            <span className="vc-vol-pct">{Math.round(volume * 100)}%</span>
          </div>

          {/* Continuous toggle */}
          <label className="vc-cont-label">
            <input
              type="checkbox"
              checked={continuous}
              onChange={e => { setContinuous(e.target.checked); stoppedByUserRef.current = false; }}
              className="vc-cont-check"
            />
            <span>محادثة مستمرة</span>
          </label>

          {/* Toggle text input */}
          <button className="vc-show-input-btn" onClick={() => setShowInput(s => !s)}>
            {showInput ? "إخفاء الكتابة" : "اكتب بدلا من ذلك"}
          </button>
        </div>

        {/*  Text input (hidden by default)  */}
        {showInput && (
          <div className="vc-input-row">
            <input
              ref={inputRef}
              type="text"
              className="vc-input"
              placeholder="اكتب سؤالك هنا..."
              disabled={phase === "thinking" || phase === "speaking"}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) {
                    (e.target as HTMLInputElement).value = "";
                    doSend(val);
                  }
                }
              }}
            />
            <button
              className="vc-send-btn"
              onClick={() => {
                if (inputRef.current?.value.trim()) {
                  const val = inputRef.current.value.trim();
                  inputRef.current.value = "";
                  doSend(val);
                }
              }}
              disabled={phase === "thinking" || phase === "speaking"}
            >
              إرسال
            </button>
          </div>
        )}
      </div>
    </div>
  );
}




