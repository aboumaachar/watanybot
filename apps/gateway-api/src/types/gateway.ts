import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";

/**
 * Typed Route Handlers
 * Reduces reliance on `any` by providing proper type definitions
 */

// Common error type for catch blocks
export type AppError = Error & { code?: string; statusCode?: number };

// Query parameters type
export interface PaginationQuery {
  limit?: string | number;
  offset?: string | number;
  q?: string;
}

// KB Admin Query
export interface KbAdminQuery extends PaginationQuery {
  type?: string;
}

// Salary Request Body
export interface SalaryCalcRequest {
  rank: string;
  degree?: number;
}

// KB Patch Request
export interface KbPatchRequest {
  [key: string]: unknown;
}

// Typed Request/Reply helpers for gateway
export type TypedFastifyRequest<T = unknown> = FastifyRequest & { body?: T; user?: any };
export type TypedFastifyReply = FastifyReply;
export type TypedFastifyInstance = FastifyInstance & { 
  kb?: any;
  runtimeKb?: any;
  pluginDb?: any;
};

// Safe query parameter extraction
export function getQueryParam(query: Record<string, any>, key: string, defaultValue: string = ""): string {
  const value = query?.[key];
  return value ? String(value) : defaultValue;
}

export function getQueryNumber(query: Record<string, any>, key: string, defaultValue: number = 0): number {
  const value = query?.[key];
  return value ? Number(value) : defaultValue;
}

// Safe error extraction
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

export function getErrorCode(err: unknown): string {
  if (err instanceof Error && "code" in err) return String((err as any).code);
  return "INTERNAL_ERROR";
}
