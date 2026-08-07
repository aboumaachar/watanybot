export type TaxiOtpPurpose = "DRIVER_PHONE_VERIFY" | "RIDER_PHONE_VERIFY";

export type TaxiOtpPolicy = {
  ttlSeconds: number;
  maxAttempts: number;
  minResendSeconds: number;
};

export const defaultTaxiOtpPolicy: TaxiOtpPolicy = {
  ttlSeconds: 300,
  maxAttempts: 5,
  minResendSeconds: 60,
};

export function isTaxiOtpExpired(createdAtIso: string, now: Date = new Date(), ttlSeconds = defaultTaxiOtpPolicy.ttlSeconds): boolean {
  const createdAt = new Date(createdAtIso).getTime();
  if (!Number.isFinite(createdAt)) return true;
  return now.getTime() - createdAt > ttlSeconds * 1000;
}

export function canAttemptTaxiOtpVerification(attempts: number, maxAttempts = defaultTaxiOtpPolicy.maxAttempts): boolean {
  return attempts >= 0 && attempts < maxAttempts;
}

export const TAXI_OTP_POLICY_MARKER = "TAXI_OTP_POLICY_SCAFFOLD_PRESENT";