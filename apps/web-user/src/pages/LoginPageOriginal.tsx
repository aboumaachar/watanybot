import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../store/app";
import { api } from "../lib/api";
import "../styles/Auth.css";

const DEV_SUPERADMIN_EMAIL = import.meta.env.VITE_DEV_SUPERADMIN_EMAIL?.trim() || "";
const DEV_SUPERADMIN_PASSWORD = import.meta.env.VITE_DEV_SUPERADMIN_PASSWORD?.trim() || "";

const OTP_LENGTH = 6;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_SEND_FAILURE_MESSAGE = "تعذر إرسال رمز التحقق حالياً. حاول لاحقاً.";
const CONNECTION_FAILURE_MESSAGE = "تعذر الاتصال بالخادم. تأكد من تشغيل الخدمة ثم حاول مجدداً.";
const OTP_DIGIT_KEYS = ["otp-digit-1", "otp-digit-2", "otp-digit-3", "otp-digit-4", "otp-digit-5", "otp-digit-6"] as const;
const GOOGLE_GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccountsIdApi = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    cancel_on_tap_outside?: boolean;
    context?: "signin" | "signup" | "use";
    ux_mode?: "popup" | "redirect";
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number | boolean>) => void;
  cancel: () => void;
};

type GoogleWindow = typeof globalThis & {
  google?: {
    accounts?: {
      id?: GoogleAccountsIdApi;
    };
  };
};

function getGoogleAccountsApi(): GoogleAccountsIdApi | undefined {
  return (globalThis as GoogleWindow).google?.accounts?.id;
}

// NOSONAR - this page intentionally keeps the full auth flow in one component.
function LoginPageOriginal() {
  const { loginWithProfile, apiBaseUrl } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const authDebugEnabled = new URLSearchParams(location.search).has("authdebug");
  const authDebugLog = useCallback((event: string, payload: Record<string, unknown>) => {
    if (!authDebugEnabled) {
      return;
    }

    console.info(`[google-auth] ${event}`, payload);
  }, [authDebugEnabled]);
  const rawNextPath = new URLSearchParams(location.search).get("next");
  const nextPath = (() => {
    if (!rawNextPath) return "/hybrid-kb-chat";
    return rawNextPath.startsWith("/") ? rawNextPath : "/hybrid-kb-chat";
  })();
  const [tab, setTab] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);

  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(new Array(OTP_LENGTH).fill(""));
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const envGoogleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";
  const [googleClientId, setGoogleClientId] = useState(envGoogleClientId);
  const [googleConfigChecked, setGoogleConfigChecked] = useState(Boolean(envGoogleClientId));
  const [googleScriptReady, setGoogleScriptReady] = useState(Boolean(getGoogleAccountsApi()));
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleNotice, setGoogleNotice] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const digitRefs = useRef<Array<HTMLInputElement | null>>(new Array(OTP_LENGTH).fill(null));
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const allowDevAdminFallback = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_ADMIN_FALLBACK === "true";
  const googleUnavailableNotice = import.meta.env.DEV
    ? "Set VITE_GOOGLE_CLIENT_ID in web-user and GOOGLE_CLIENT_ID in gateway to enable Google sign-in."
    : "Google sign-in is not configured in this environment yet.";

  useEffect(() => {
    if (envGoogleClientId) {
      setGoogleClientId(envGoogleClientId);
      setGoogleConfigChecked(true);
      return;
    }

    let disposed = false;
    setGoogleConfigChecked(false);

    void fetch(`${apiBaseUrl}/api/auth/google/config`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("GOOGLE_CONFIG_UNAVAILABLE");
        }

        const payload = await response.json() as { enabled?: boolean; clientId?: string };
        if (disposed) return;

        const runtimeClientId = payload.clientId?.trim() || "";
        setGoogleClientId(payload.enabled && runtimeClientId ? runtimeClientId : "");
      })
      .catch(() => {
        if (!disposed) {
          setGoogleClientId("");
        }
      })
      .finally(() => {
        if (!disposed) {
          setGoogleConfigChecked(true);
        }
      });

    return () => {
      disposed = true;
    };
  }, [apiBaseUrl, envGoogleClientId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const profile = await api.login(email, password, apiBaseUrl, rememberMe);
      loginWithProfile(profile);
      navigate(profile.role === "superadmin" ? "/superadmin" : nextPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setError(
        err instanceof TypeError || message.toLowerCase().includes("fetch")
          ? CONNECTION_FAILURE_MESSAGE
          : (message || "حدث خطأ"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDevSuperadminLogin() {
    setError("");
    if (!DEV_SUPERADMIN_EMAIL || !DEV_SUPERADMIN_PASSWORD) {
      setError("بيانات الدخول السريع غير مهيأة في هذا البيئة.");
      return;
    }

    setDevLoading(true);
    try {
      const profile = await api.login(DEV_SUPERADMIN_EMAIL, DEV_SUPERADMIN_PASSWORD, apiBaseUrl, false);
      loginWithProfile(profile);
      const fallbackPath = rawNextPath ? nextPath : "/superadmin";
      navigate(profile.role === "superadmin" ? "/superadmin" : fallbackPath);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "تعذر تنفيذ دخول التطوير");
    } finally {
      setDevLoading(false);
    }
  }

  const handleGoogleCredential = useCallback(async (credential: string) => {
    authDebugLog("credential callback received", { hasCredential: Boolean(credential) });
    if (!credential) {
      setError("تعذر استلام بيانات Google. حاول مرة أخرى.");
      return;
    }

    setError("");
    setGoogleNotice("");
    setGoogleBusy(true);
    setLoading(true);
    try {
      const profile = await api.loginWithGoogleCredential(credential, apiBaseUrl);
      authDebugLog("profile after login", {
        isAuthed: Boolean(profile?.isAuthed),
        role: profile?.role || null,
        hasId: Boolean(profile?.id),
      });
      loginWithProfile(profile);
      authDebugLog("navigating", { next: nextPath });
      navigate(nextPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setError(
        err instanceof TypeError || message.toLowerCase().includes("fetch")
          ? CONNECTION_FAILURE_MESSAGE
          : (message || "تعذر تسجيل الدخول عبر Google حالياً."),
      );
    } finally {
      setGoogleBusy(false);
      setLoading(false);
    }
  }, [apiBaseUrl, authDebugLog, loginWithProfile, navigate, nextPath]);

  useEffect(() => {
    if (!googleClientId) {
      setGoogleScriptReady(false);
      setGoogleNotice("");
      return;
    }

    if (getGoogleAccountsApi()) {
      setGoogleScriptReady(true);
      return;
    }

    let disposed = false;
    const handleLoad = () => {
      if (!disposed) {
        setGoogleScriptReady(true);
        setGoogleNotice("");
      }
    };
    const handleError = () => {
      if (!disposed) {
        setGoogleNotice("تعذر تحميل خدمة Google حالياً.");
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_GSI_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", handleLoad);
      existingScript.addEventListener("error", handleError);
      return () => {
        disposed = true;
        existingScript.removeEventListener("load", handleLoad);
        existingScript.removeEventListener("error", handleError);
      };
    }

    const script = document.createElement("script");
    script.src = GOOGLE_GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.head.appendChild(script);

    return () => {
      disposed = true;
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, [googleClientId]);

  useEffect(() => {
    if (!googleClientId || !googleScriptReady || !googleButtonRef.current) {
      return;
    }

    const googleAccountsApi = getGoogleAccountsApi();
    if (!googleAccountsApi) {
      return;
    }

    const buttonHost = googleButtonRef.current;
    const buttonWidth = Math.max(240, Math.min(buttonHost.offsetWidth || 320, 360));

    buttonHost.replaceChildren();
    googleAccountsApi.initialize({
      client_id: googleClientId,
      callback: (response) => {
        setGoogleBusy(true);
        authDebugLog("google callback payload", {
          hasCredential: Boolean(response?.credential),
          responseKeys: response ? Object.keys(response) : [],
        });
        void handleGoogleCredential(response.credential || "");
      },
      cancel_on_tap_outside: true,
      context: "signin",
      ux_mode: "popup",
    });
    googleAccountsApi.renderButton(buttonHost, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "left",
      locale: "ar",
      width: buttonWidth,
    });

    return () => {
      googleAccountsApi.cancel();
      buttonHost.replaceChildren();
    };
  }, [authDebugLog, googleClientId, googleScriptReady, handleGoogleCredential]);

  function startResendTimer(durationSeconds = OTP_RESEND_COOLDOWN_SECONDS) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setResendTimer(durationSeconds);
    timerRef.current = setInterval(() => {
      setResendTimer((current) => {
        if (current <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  async function handleSendOtp() {
    if (!phone.trim()) {
      setError("أدخل رقم هاتفك أولاً.");
      return;
    }

    const nextPhone = phone.trim();
    const hadOtpSent = otpSent;
    setError("");
    setSendingOtp(true);
    try {
      await api.requestOtp(nextPhone, apiBaseUrl);
      setPhone(nextPhone);
      setOtpSent(true);
      setOtpDigits(new Array(OTP_LENGTH).fill(""));
      startResendTimer();
      setTimeout(() => digitRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setError(
        err instanceof TypeError || message.toLowerCase().includes("fetch")
          ? CONNECTION_FAILURE_MESSAGE
          : (message || OTP_SEND_FAILURE_MESSAGE),
      );
      if (!hadOtpSent) {
        setOtpSent(false);
      }
    } finally {
      setSendingOtp(false);
    }
  }

  function handleOtpDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = digit;
    setOtpDigits(nextDigits);
    if (digit && index < OTP_LENGTH - 1) {
      digitRefs.current[index + 1]?.focus();
    }
    if (nextDigits.every(Boolean)) {
      void handleVerifyOtp(nextDigits.join(""));
    }
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerifyOtp(code?: string) {
    const otp = code ?? otpDigits.join("");
    if (otp.length < OTP_LENGTH) {
      setError("أكمل إدخال رمز التحقق.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const profile = await api.verifyOtp(phone.trim(), otp, apiBaseUrl);
      loginWithProfile(profile);
      navigate(nextPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setError(
        err instanceof TypeError || message.toLowerCase().includes("fetch")
          ? CONNECTION_FAILURE_MESSAGE
          : (message || "رمز التحقق غير صحيح أو انتهت صلاحيته."),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="watany-auth-page auth-page approved-login-page" dir="rtl">
      <button className="auth-page__backdrop" type="button" aria-label="العودة إلى الصفحة الرئيسية" onClick={() => navigate("/home")} />
      <div className="auth-shell approved-login-shell">
        <div className="auth-card approved-login-card">
          <div className="auth-card__header approved-login-header">
            <img className="approved-login-logo" src="/watany-v4/brand/mowatany-logo.png" alt="شعار موطني" />
            <h1>تسجيل الدخول</h1>
          </div>

          {error && <div className="auth-error auth-error--global">{error}</div>}

          {tab === "email" && (
            <form className="approved-login-form" onSubmit={(event) => void handleSubmit(event)}>
              <div className="auth-field">
                <label htmlFor="email">البريد الإلكتروني</label>
                <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@email.com" required dir="ltr" />
              </div>
              <div className="auth-field">
                <label htmlFor="password">كلمة المرور</label>
                <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required dir="ltr" />
              </div>
              <div className="auth-remember">
                <label className="auth-checkbox">
                  <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                  <span>تذكرني على هذا الجهاز</span>
                </label>
              </div>
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? "جارٍ الدخول..." : "تسجيل الدخول"}
              </button>
            </form>
          )}

          <section className="auth-provider">
            {googleClientId ? (
              <div className="auth-google-slot-wrap">
                {!googleScriptReady && (
                  <button className="auth-google-placeholder" type="button" disabled>
                    جارٍ تحميل Google...
                  </button>
                )}
                <div ref={googleButtonRef} className={`auth-google-slot ${googleScriptReady ? "" : "auth-google-slot--hidden"}`} />
                <p className="auth-provider__hint">
                  {googleBusy
                    ? "جارٍ التحقق من حساب Google..."
                    : (googleNotice || "بعد التحقق من Google سيتم إنشاء جلسة موطني نفسها مباشرة.")}
                </p>
              </div>
            ) : (
              <div className="auth-google-slot-wrap">
                <button
                  className="auth-google-placeholder"
                  type="button"
                  disabled={!googleConfigChecked}
                  onClick={() => {
                    if (!googleConfigChecked) return;
                    setGoogleNotice(googleUnavailableNotice);
                    setError(googleUnavailableNotice);
                  }}
                >
                  {googleConfigChecked ? "المتابعة عبر Google" : "جارٍ تجهيز Google..."}
                </button>
                <p className="auth-provider__hint">
                  {googleConfigChecked ? googleUnavailableNotice : "جارٍ التحقق من إعدادات Google على الخادم..."}
                </p>
              </div>
            )}
          </section>

          {tab === "phone" && (
            <div className="auth-panel">
              <button className="approved-login-back-to-email" type="button" onClick={() => { setTab("email"); setError(""); }}>
                العودة إلى الدخول بالبريد الإلكتروني
              </button>
              {otpSent ? (
                <>
                  <p className="auth-panel__eyebrow">تحقق عبر الهاتف</p>
                  <h2 className="auth-panel__title">أدخل رمز التحقق</h2>
                  <p className="auth-panel__copy">
                    أرسلنا رمزاً من {OTP_LENGTH} أرقام إلى <strong dir="ltr">{phone}</strong>
                  </p>
                  <div className="auth-otp-digits">
                    {OTP_DIGIT_KEYS.map((digitKey, index) => (
                      <input
                        key={digitKey}
                        ref={(element) => { digitRefs.current[index] = element; }}
                        className="auth-otp-digit"
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={otpDigits[index]}
                        onChange={(event) => handleOtpDigit(index, event.target.value)}
                        onKeyDown={(event) => handleOtpKeyDown(index, event)}
                        dir="ltr"
                      />
                    ))}
                  </div>
                  <button className="auth-btn" type="button" onClick={() => void handleVerifyOtp()} disabled={loading}>
                    {loading ? "جارٍ التحقق..." : "تأكيد الرمز"}
                  </button>
                  <div className="auth-otp-resend">
                    {resendTimer > 0 ? (
                      <span>لم يصلك الرمز؟ إعادة الإرسال بعد {resendTimer} ثانية</span>
                    ) : (
                      <>لم تصلك الرسالة؟ <button type="button" onClick={() => void handleSendOtp()}>إعادة الإرسال</button></>
                    )}
                  </div>
                  <button className="auth-btn auth-btn--ghost" type="button" onClick={() => { setOtpSent(false); setOtpDigits(new Array(OTP_LENGTH).fill("")); setError(""); }}>
                    تغيير رقم الهاتف
                  </button>
                </>
              ) : (
                <>
                  <p className="auth-panel__eyebrow">تحقق عبر الهاتف</p>
                  <h2 className="auth-panel__title">أدخل رقم هاتفك</h2>
                  <p className="auth-panel__copy">سنرسل رمز تحقق سريعاً بدون المساس بمسار الرسائل أو إعدادات WhatsApp الحالية.</p>
                  <div className="auth-field">
                    <label htmlFor="phone">رقم الهاتف</label>
                    <div className="auth-otp-row">
                      <input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="03 123 456"
                        dir="ltr"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleSendOtp();
                          }
                        }}
                      />
                      <button className="auth-send-btn" type="button" onClick={() => void handleSendOtp()} disabled={sendingOtp}>
                        {sendingOtp ? "جارٍ الإرسال..." : "إرسال رمز التحقق"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <button className="approved-login-guest" type="button" onClick={() => navigate("/home")}>المتابعة كزائر</button>
          <div className="approved-login-links">
            <button type="button" onClick={() => setError("سيتم تفعيل استعادة كلمة المرور قريباً.")}>نسيت كلمة المرور؟</button>
            <button type="button" onClick={() => { setTab("phone"); setError(""); }}>الدخول لمرة واحدة</button>
          </div>
          <p className="auth-link approved-login-register">ليس لديك حساب؟ <Link to="/register">إنشاء حساب جديد</Link></p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <LoginPageOriginal />;
}


