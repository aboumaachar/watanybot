"use client";
import { useEffect, useMemo, useState } from "react";

type Props = {
  onTranscript: (text: string) => void;
  speakText?: string;
};

export default function VoiceTools({ onTranscript, speakText }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const SpeechRecognitionCtor: any = useMemo(() => {
    // @ts-ignore
    return typeof window !== "undefined"
      ? (window.SpeechRecognition || (window as any).webkitSpeechRecognition)
      : null;
  }, []);

  useEffect(() => {
    setSupported(!!SpeechRecognitionCtor);
  }, [SpeechRecognitionCtor]);

  function startListening() {
    setErr(null);
    if (!SpeechRecognitionCtor) {
      setErr("ميزة الصوت غير مدعومة على هذا المتصفح.");
      return;
    }
    const rec = new SpeechRecognitionCtor();
    rec.lang = "ar-LB"; // works fine even if browser maps to ar
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => {
      setErr("صار في مشكلة بالصوت. جرّب مرة تانية.");
      setListening(false);
    };
    rec.onresult = (event: any) => {
      const text = event?.results?.[0]?.[0]?.transcript || "";
      if (text.trim()) onTranscript(text.trim());
    };

    rec.start();
  }

  function speak() {
    setErr(null);
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) {
      setErr("ميزة القراءة بالصوت مش مدعومة هون.");
      return;
    }
    const t = (speakText || "").trim();
    if (!t) return;

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "ar-LB";
    u.rate = 0.95; // شوي بطيء لكبار السن
    window.speechSynthesis.speak(u);
  }

  return (
    <div className="rounded-2xl border p-3">
      <div className="font-bold mb-2">مساعدة بالصوت</div>

      {err && <div className="mb-2 rounded-2xl border border-red-400 p-2">{err}</div>}

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-2xl border px-4 py-3 bg-white shadow-sm"
          onClick={startListening}
          disabled={!supported || listening}
        >
          {listening ? "…عم بسمعك" : "🎙️ احكي بدل ما تكتب"}
        </button>

        <button
          className="rounded-2xl border px-4 py-3 bg-white shadow-sm"
          onClick={speak}
          disabled={!speakText}
        >
          🔊 سمّعني الشرح
        </button>
      </div>

      <div className="opacity-80 mt-2">
        {supported
          ? "إذا بتحب… احكي جملة بسيطة مثل: (رتبتي عميد درجة 4 متأهل وعندي ولد)."
          : "إذا جهازك/متصفحك ما بيدعم الصوت، ولا يهمك—استعمل الأزرار."}
      </div>
    </div>
  );
}