import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";

import {
  erpNextBaseUrl,
  erpNextCredentialFile,
  erpNextRequestTimeoutMs,
  erpNextSiteName,
} from "../../lib/config";

interface ErpNextCredentialStore {
  apiKey: string;
  apiSecret: string;
  principal: string;
}

export type ErpNextContact = {
  name: string;
  first_name?: string;
  last_name?: string;
  email_id?: string;
  status?: string;
  company_name?: string;
  phone?: string;
  mobile_no?: string;
};

export interface ErpNextReadiness {
  site: string;
  reachable: boolean;
  authenticatedPrincipalPresent: boolean;
  principal: string | null;
  httpStatus: number;
}

export class ErpNextClient {
  private readonly baseUrl: URL;
  private readonly siteName: string;
  private readonly credentialFile: string;
  private readonly timeoutMs: number;

  public constructor(options?: {
    baseUrl?: string;
    siteName?: string;
    credentialFile?: string;
    timeoutMs?: number;
  }) {
    this.baseUrl = new URL(options?.baseUrl || erpNextBaseUrl);
    const requestedSiteName = options?.siteName || erpNextSiteName;
    if (requestedSiteName !== erpNextSiteName) {
      throw new ErpNextRequestError(400, "erpnext_site_override_rejected");
    }
    this.siteName = erpNextSiteName;
    this.credentialFile = options?.credentialFile || erpNextCredentialFile || "";
    this.timeoutMs = options?.timeoutMs || erpNextRequestTimeoutMs;
  }

  public async readAuthenticatedIdentity(): Promise<ErpNextReadiness> {
    const credential = await this.readCredential();
    try {
      const response = await this.requestIdentity(credential.apiKey, credential.apiSecret);
      const payload = JSON.parse(response.body) as { message?: unknown };
      const principal = typeof payload?.message === "string" ? payload.message : null;

      if (response.statusCode < 200 || response.statusCode >= 300 || !principal) {
        throw new ErpNextRequestError(response.statusCode || 502, "erpnext_identity_denied");
      }

      return {
        site: this.siteName,
        reachable: true,
        authenticatedPrincipalPresent: true,
        principal,
        httpStatus: response.statusCode,
      };
    } catch (error) {
      if (error instanceof ErpNextRequestError) throw error;
      throw new ErpNextRequestError(502, "erpnext_unavailable");
    }
  }

  public async listContacts(limit = 50): Promise<ErpNextContact[]> {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
    const fields = encodeURIComponent(JSON.stringify([
      "name", "first_name", "last_name", "email_id", "status", "company_name", "phone", "mobile_no",
    ]));
    const response = await this.requestJson("GET", `/api/resource/Contact?fields=${fields}&limit_page_length=${boundedLimit}`);
    return Array.isArray(response.data) ? response.data as ErpNextContact[] : [];
  }

  public async getContact(name: string): Promise<ErpNextContact> {
    const response = await this.requestJson("GET", `/api/resource/Contact/${encodeURIComponent(name)}`);
    return response.data as ErpNextContact;
  }

  public async createContact(data: Record<string, unknown>): Promise<ErpNextContact> {
    const response = await this.requestJson("POST", "/api/resource/Contact", data);
    return response.data as ErpNextContact;
  }

  public async updateContact(name: string, data: Record<string, unknown>): Promise<ErpNextContact> {
    const response = await this.requestJson("PUT", `/api/resource/Contact/${encodeURIComponent(name)}`, data);
    return response.data as ErpNextContact;
  }

  public async deleteContact(name: string): Promise<void> {
    await this.requestJson("DELETE", `/api/resource/Contact/${encodeURIComponent(name)}`);
  }

  private async requestJson(method: string, requestPath: string, body?: Record<string, unknown>): Promise<{ data?: unknown }> {
    const credential = await this.readCredential();
    const transport = this.baseUrl.protocol === "https:" ? https : http;
    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const request = transport.request(new URL(requestPath, this.baseUrl), {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Host: this.siteName,
          Authorization: `token ${credential.apiKey}:${credential.apiSecret}`,
        },
        timeout: this.timeoutMs,
      }, (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.on("end", () => resolve({
          statusCode: incoming.statusCode || 502,
          body: Buffer.concat(chunks).toString("utf8"),
        }));
      });
      request.on("timeout", () => request.destroy(new Error("erpnext_request_timeout")));
      request.on("error", reject);
      if (body) request.write(JSON.stringify(body));
      request.end();
    }).catch(() => {
      throw new ErpNextRequestError(502, "erpnext_unavailable");
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new ErpNextRequestError(response.statusCode, "erpnext_contact_request_denied");
    }
    try {
      return JSON.parse(response.body) as { data?: unknown };
    } catch {
      throw new ErpNextRequestError(502, "erpnext_invalid_response");
    }
  }

  private requestIdentity(apiKey: string, apiSecret: string): Promise<{ statusCode: number; body: string }> {
    const transport = this.baseUrl.protocol === "https:" ? https : http;
    return new Promise((resolve, reject) => {
      const request = transport.request(new URL("/api/method/frappe.auth.get_logged_user", this.baseUrl), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Host: this.siteName,
          Authorization: `token ${apiKey}:${apiSecret}`,
        },
        timeout: this.timeoutMs,
      }, (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => resolve({
          statusCode: response.statusCode || 502,
          body: Buffer.concat(chunks).toString("utf8"),
        }));
      });
      request.on("timeout", () => request.destroy(new Error("erpnext_request_timeout")));
      request.on("error", reject);
      request.end();
    });
  }

  private async readCredential(): Promise<ErpNextCredentialStore> {
    if (!this.credentialFile) {
      throw new ErpNextRequestError(503, "erpnext_credential_source_unconfigured");
    }

    try {
      const raw = await fs.readFile(this.credentialFile, "utf8");
      const value = JSON.parse(raw) as Partial<ErpNextCredentialStore>;
      if (!value.apiKey || !value.apiSecret || !value.principal) {
        throw new Error("invalid credential store");
      }
      return {
        apiKey: value.apiKey,
        apiSecret: value.apiSecret,
        principal: value.principal,
      };
    } catch {
      throw new ErpNextRequestError(503, "erpnext_credential_source_unavailable");
    }
  }
}

export class ErpNextRequestError extends Error {
  public readonly statusCode: number;
  public readonly safeCode: string;

  public constructor(statusCode: number, safeCode: string) {
    super(safeCode);
    this.statusCode = statusCode;
    this.safeCode = safeCode;
    this.name = "ErpNextRequestError";
  }
}