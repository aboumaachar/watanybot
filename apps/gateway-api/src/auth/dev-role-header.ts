/**
 * Dev/test-only superadmin impersonation through the `x-watany-role` header.
 *
 * Opt-in only: honoured when NODE_ENV is "development" or "test" AND
 * WATANY_ALLOW_DEV_ROLE_HEADER=true. Any other environment (production,
 * staging, a canary started without its .env, NODE_ENV unset) ignores the
 * header, so a forged header can never grant a role there.
 */
export function isDevRoleHeaderEnabled(): boolean {
  const env = process.env.NODE_ENV;
  return (env === "development" || env === "test")
    && process.env.WATANY_ALLOW_DEV_ROLE_HEADER?.trim().toLowerCase() === "true";
}
