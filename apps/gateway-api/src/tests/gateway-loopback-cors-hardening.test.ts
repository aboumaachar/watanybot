import { describe, expect, it } from "vitest";
import {
  isCorsOriginAllowed,
  isIgnorableGatewayDisconnectError,
  isLoopbackDevOrigin,
} from "../lib/gateway-hardening";

const allowlist = new Set([
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "https://watany.example",
]);

describe("gateway loopback and shell hardening", () => {
  it("accepts local dev origins with dynamic ports only in development mode", () => {
    expect(isLoopbackDevOrigin("http://localhost:5176")).toBe(true);
    expect(isLoopbackDevOrigin("http://127.0.0.1:4021")).toBe(true);
    expect(isLoopbackDevOrigin("http://172.24.208.1:5174")).toBe(true);
    expect(isLoopbackDevOrigin("http://192.168.0.216:3001")).toBe(true);
    expect(isLoopbackDevOrigin("https://localhost:9443")).toBe(true);

    expect(isCorsOriginAllowed("http://localhost:5176", { allowlist, isDevelopment: true })).toBe(true);
    expect(isCorsOriginAllowed("http://127.0.0.1:4021", { allowlist, isDevelopment: true })).toBe(true);
    expect(isCorsOriginAllowed("http://172.24.208.1:5174", { allowlist, isDevelopment: true })).toBe(true);
    expect(isCorsOriginAllowed("http://192.168.0.216:3001", { allowlist, isDevelopment: true })).toBe(true);
    expect(isCorsOriginAllowed("https://localhost:9443", { allowlist, isDevelopment: true })).toBe(true);
  });

  it("rejects non-local, malformed, and non-http origins from the dynamic dev exception", () => {
    expect(isLoopbackDevOrigin("http://example.com:5176")).toBe(false);
    expect(isLoopbackDevOrigin("http://172.40.0.1:5176")).toBe(false);
    expect(isLoopbackDevOrigin("chrome-extension://abc123")).toBe(false);
    expect(isLoopbackDevOrigin("http://localhost")).toBe(false);
    expect(isLoopbackDevOrigin("not an origin")).toBe(false);

    expect(isCorsOriginAllowed("http://example.com:5176", { allowlist, isDevelopment: true })).toBe(false);
    expect(isCorsOriginAllowed("http://172.40.0.1:5176", { allowlist, isDevelopment: true })).toBe(false);
    expect(isCorsOriginAllowed("chrome-extension://abc123", { allowlist, isDevelopment: true })).toBe(false);
  });

  it("does not broaden production-like origin handling beyond the explicit allowlist", () => {
    expect(isCorsOriginAllowed("http://localhost:5176", { allowlist, isDevelopment: false })).toBe(false);
    expect(isCorsOriginAllowed("http://127.0.0.1:4021", { allowlist, isDevelopment: false })).toBe(false);
    expect(isCorsOriginAllowed("https://watany.example", { allowlist, isDevelopment: false })).toBe(true);
    expect(isCorsOriginAllowed(undefined, { allowlist, isDevelopment: false })).toBe(true);
  });

  it("classifies aborted client writes as ignorable without masking unrelated failures", () => {
    expect(isIgnorableGatewayDisconnectError({ code: "ECONNABORTED" })).toBe(true);
    expect(isIgnorableGatewayDisconnectError({ code: "EPIPE" })).toBe(true);
    expect(isIgnorableGatewayDisconnectError({ code: "ECONNRESET" })).toBe(true);
    expect(isIgnorableGatewayDisconnectError(new Error("boom"))).toBe(false);
    expect(isIgnorableGatewayDisconnectError(null)).toBe(false);
  });
});