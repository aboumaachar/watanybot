import { describe, expect, it } from "vitest";
import { assertDisposableTestDatabase } from "./helpers/disposable-db";

const ok = { DATABASE_URL: "postgresql://watany_test@127.0.0.1:55432/watany_test", WATANY_TEST_DB_DISPOSABLE: "true" };

describe("assertDisposableTestDatabase (fail-closed)", () => {
  it("accepts a local test database that is explicitly marked disposable", () => {
    expect(() => assertDisposableTestDatabase(ok)).not.toThrow();
    expect(() => assertDisposableTestDatabase({ ...ok, DATABASE_URL: "postgres://u@localhost:5432/app_test" })).not.toThrow();
  });

  it.each([
    ["no DATABASE_URL", { WATANY_TEST_DB_DISPOSABLE: "true" }, "not set"],
    ["unparseable URL", { ...ok, DATABASE_URL: "not a url" }, "not a valid URL"],
    ["non-postgres protocol", { ...ok, DATABASE_URL: "mysql://u@127.0.0.1/watany_test" }, "unsupported protocol"],
    ["remote host", { ...ok, DATABASE_URL: "postgresql://u@54.39.157.227:5433/watany_test" }, "not local"],
    ["production database name", { ...ok, DATABASE_URL: "postgresql://u@127.0.0.1:5433/watany_gateway_prod" }, "not a test database"],
    ["flag missing", { DATABASE_URL: ok.DATABASE_URL }, "WATANY_TEST_DB_DISPOSABLE"],
    ["flag not true", { ...ok, WATANY_TEST_DB_DISPOSABLE: "yes" }, "WATANY_TEST_DB_DISPOSABLE"],
  ])("refuses %s", (_name, env, message) => {
    expect(() => assertDisposableTestDatabase(env as NodeJS.ProcessEnv)).toThrow(message);
  });
});
