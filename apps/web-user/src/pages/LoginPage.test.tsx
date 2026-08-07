/** @vitest-environment happy-dom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const {
  loginMock,
  loginWithProfileMock,
  navigateMock,
  googleLoginMock,
  emailLoginMock,
  requestOtpMock,
  verifyOtpMock,
} = vi.hoisted(() => ({
  loginMock: vi.fn(),
  loginWithProfileMock: vi.fn(),
  navigateMock: vi.fn(),
  googleLoginMock: vi.fn(),
  emailLoginMock: vi.fn(),
  requestOtpMock: vi.fn(),
  verifyOtpMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../store/app", () => ({
  useApp: () => ({
    login: loginMock,
    loginWithProfile: loginWithProfileMock,
    apiBaseUrl: "http://api.test",
  }),
}));

vi.mock("../lib/api", () => ({
  api: {
    requestOtp: requestOtpMock,
    verifyOtp: verifyOtpMock,
    login: emailLoginMock,
    loginWithGoogleCredential: googleLoginMock,
  },
}));

type GoogleCallback = (response: { credential?: string }) => void;

function findButtonByText(container: HTMLDivElement, text: string) {
  return Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes(text));
}

function installGoogleAccountsMock() {
  const initialize = vi.fn();
  const renderButton = vi.fn();
  const cancel = vi.fn();

  (globalThis as typeof globalThis & {
    google?: {
      accounts?: {
        id?: {
          initialize: typeof initialize;
          renderButton: typeof renderButton;
          cancel: typeof cancel;
        };
      };
    };
  }).google = {
    accounts: {
      id: {
        initialize,
        renderButton,
        cancel,
      },
    },
  };

  return { initialize, renderButton, cancel };
}

function getGoogleCallback(initializeMock: ReturnType<typeof vi.fn>): GoogleCallback {
  const initArg = initializeMock.mock.calls[0]?.[0] as { callback?: GoogleCallback } | undefined;
  if (!initArg?.callback) {
    throw new Error("Google callback was not initialized");
  }
  return initArg.callback;
}

async function flushEffects(times = 3) {
  await act(async () => {
    for (let index = 0; index < times; index += 1) {
      await Promise.resolve();
    }
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(globalThis.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("LoginPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container?.isConnected) {
      container.remove();
    }
    delete (globalThis as typeof globalThis & { google?: unknown }).google;
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  async function renderPage() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/login?next=%2Fsettings"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <LoginPage />
        </MemoryRouter>,
      );
    });
    await flushEffects();
  }

  async function ensureOriginalShown() {
    const primaryContinue = container.querySelector('.motany-login-primary,[data-watany-login-continue="true"],.motany-login-input-shell') as HTMLElement | null;
    if (!primaryContinue) {
      return;
    }

    await act(async () => {
      primaryContinue.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushEffects(4);
  }

  it("preserves phone OTP and email login paths in the redesigned screen", async () => {
    requestOtpMock.mockResolvedValue({ ok: true, message: "ok" });
    verifyOtpMock.mockResolvedValue({ isAuthed: true, role: "public", name: "Veteran" });
    const authenticatedProfile = { isAuthed: true, role: "public", email: "user@example.com", name: "Veteran User" };
    emailLoginMock.mockResolvedValue(authenticatedProfile);

    await renderPage();
    await ensureOriginalShown();

    expect(container.textContent).toContain("Google");
    expect(container.textContent).toContain("البريد الإلكتروني");

    const oneTimeButton = findButtonByText(container, "الدخول لمرة واحدة");
    expect(oneTimeButton).toBeTruthy();
    await act(async () => {
      oneTimeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const phoneInput = container.querySelector("#phone") as HTMLInputElement | null;
    const sendOtpButton = findButtonByText(container, "إرسال رمز التحقق");
    expect(phoneInput).not.toBeNull();
    expect(sendOtpButton).toBeTruthy();

    await act(async () => {
      if (phoneInput) {
        setInputValue(phoneInput, "03123456");
      }
      sendOtpButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(requestOtpMock).toHaveBeenCalledWith("03123456", "http://api.test");
    expect(container.textContent).toContain("أدخل رمز التحقق");

    const otpInputs = Array.from(container.querySelectorAll(".auth-otp-digit")) as HTMLInputElement[];
    expect(otpInputs).toHaveLength(6);

    await act(async () => {
      otpInputs.forEach((input, index) => {
        setInputValue(input, String(index + 1));
      });
    });
    await flushEffects(5);

    expect(verifyOtpMock).toHaveBeenCalledWith("03123456", "123456", "http://api.test");
    expect(loginWithProfileMock).toHaveBeenCalledWith(expect.objectContaining({ isAuthed: true }));
    expect(navigateMock).toHaveBeenCalledWith("/settings");

    const emailTab = findButtonByText(container, "العودة إلى الدخول بالبريد الإلكتروني");
    expect(emailTab).toBeTruthy();

    await act(async () => {
      emailTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const emailInput = container.querySelector("#email") as HTMLInputElement | null;
    const passwordInput = container.querySelector("#password") as HTMLInputElement | null;
    const submitButton = findButtonByText(container, "دخول");
    expect(emailInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();
    expect(submitButton).toBeTruthy();

    await act(async () => {
      if (emailInput) {
        setInputValue(emailInput, "user@example.com");
      }
      if (passwordInput) {
        setInputValue(passwordInput, "secret-password");
      }
      submitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(emailLoginMock).toHaveBeenCalledWith("user@example.com", "secret-password", "http://api.test", false);
    expect(loginWithProfileMock).toHaveBeenCalledWith(authenticatedProfile);
    expect(navigateMock).toHaveBeenLastCalledWith("/settings");
  });

  it("logs in through Google and redirects to next when the Google credential succeeds", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "google-client-id-123");
    const googleAccounts = installGoogleAccountsMock();
    const nextProfile = { isAuthed: true, role: "public", email: "google@example.com", name: "Google User" };
    googleLoginMock.mockResolvedValue(nextProfile);

    await renderPage();
    // reveal original login so the Google slot initializes
    const motanyGoogle = container.querySelector('.motany-login-google') as HTMLElement | null;
    if (motanyGoogle) {
      await act(async () => {
        motanyGoogle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushEffects(4);
    } else {
      await ensureOriginalShown();
    }

    expect(googleAccounts.initialize).toHaveBeenCalledTimes(1);
    expect(googleAccounts.renderButton).toHaveBeenCalledTimes(1);

    const callback = getGoogleCallback(googleAccounts.initialize);

    await act(async () => {
      callback({ credential: "google-id-token" });
    });
    await flushEffects(6);

    expect(googleLoginMock).toHaveBeenCalledWith("google-id-token", "http://api.test");
    expect(loginWithProfileMock).toHaveBeenCalledWith(expect.objectContaining({ isAuthed: true, email: "google@example.com" }));
    expect(navigateMock).toHaveBeenLastCalledWith("/settings");
  });

  it("shows a user-facing error when Google returns no credential", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "google-client-id-123");
    const googleAccounts = installGoogleAccountsMock();

    await renderPage();
    const motanyGoogle2 = container.querySelector('.motany-login-google') as HTMLElement | null;
    if (motanyGoogle2) {
      await act(async () => {
        motanyGoogle2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushEffects(3);
    } else {
      await ensureOriginalShown();
    }

    const callback = getGoogleCallback(googleAccounts.initialize);

    await act(async () => {
      callback({});
    });
    await flushEffects(3);

    expect(googleLoginMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("تعذر استلام بيانات Google. حاول مرة أخرى.");
  });

  it("shows the backend verification error when Google login fails", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "google-client-id-123");
    const googleAccounts = installGoogleAccountsMock();
    googleLoginMock.mockRejectedValue(new Error("تعذر التحقق من حساب Google"));

    await renderPage();
    const motanyGoogle3 = container.querySelector('.motany-login-google') as HTMLElement | null;
    if (motanyGoogle3) {
      await act(async () => {
        motanyGoogle3.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushEffects(6);
    } else {
      await ensureOriginalShown();
    }

    const callback = getGoogleCallback(googleAccounts.initialize);

    await act(async () => {
      callback({ credential: "expired-google-token" });
    });
    await flushEffects(6);

    expect(googleLoginMock).toHaveBeenCalledWith("expired-google-token", "http://api.test");
    expect(loginWithProfileMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("تعذر التحقق من حساب Google");
  });
});