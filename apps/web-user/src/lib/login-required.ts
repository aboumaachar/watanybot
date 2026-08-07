export const LOGIN_REQUIRED_ERROR_CODE = "LOGIN_REQUIRED";

export const LOGIN_REQUIRED_GATE_MESSAGE_AR =
  "هذه التفاصيل متاحة للمستخدمين المسجلين فقط لحماية أصحاب الإعلانات والمستخدمين من الاحتيال وسوء الاستخدام. سجّل الدخول أو أنشئ حساباً للمتابعة.";

export function isLoginRequiredError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = (error.message || "").trim().toUpperCase();
  return msg === LOGIN_REQUIRED_ERROR_CODE || msg.includes(LOGIN_REQUIRED_ERROR_CODE);
}
