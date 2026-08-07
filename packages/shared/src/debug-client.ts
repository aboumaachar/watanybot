/**
 * Debug Console Client
 * Frontend utility to connect to backend debug console
 */

interface DebugLog {
  timestamp: string;
  level: string;
  message: string;
  data?: unknown;
}

interface PerformanceMetric {
  route: string;
  method: string;
  duration: number;
  timestamp: string;
  statusCode?: number;
}

interface DebugStats {
  totalLogs: number;
  logCounts: Record<string, number>;
  totalRequests: number;
  avgResponseTime: number;
  slowRequests: number;
}

class DebugConsoleClient {
  private baseUrl: string;
  private autoRefresh: boolean = false;
  private refreshInterval?: number;

  constructor(baseUrl: string = "http://localhost:4001") {
    this.baseUrl = baseUrl;
  }

  async getLogs(filter?: {
    level?: string;
    since?: string;
    limit?: number;
  }): Promise<{ logs: DebugLog[]; count: number }> {
    const params = new URLSearchParams();
    if (filter?.level) params.set("level", filter.level);
    if (filter?.since) params.set("since", filter.since);
    if (filter?.limit) params.set("limit", filter.limit.toString());

    const response = await fetch(`${this.baseUrl}/api/debug/logs?${params}`);
    const data = await response.json();
    return data;
  }

  async getPerformance(filter?: {
    route?: string;
    minDuration?: number;
    limit?: number;
  }): Promise<{ performance: PerformanceMetric[]; count: number }> {
    const params = new URLSearchParams();
    if (filter?.route) params.set("route", filter.route);
    if (filter?.minDuration)
      params.set("minDuration", filter.minDuration.toString());
    if (filter?.limit) params.set("limit", filter.limit.toString());

    const response = await fetch(
      `${this.baseUrl}/api/debug/performance?${params}`
    );
    const data = await response.json();
    return data;
  }

  async getStats(): Promise<{ stats: DebugStats }> {
    const response = await fetch(`${this.baseUrl}/api/debug/stats`);
    const data = await response.json();
    return data;
  }

  async clearLogs(): Promise<{ ok: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/debug/clear`, {
      method: "POST",
    });
    const data = await response.json();
    return data;
  }

  async query(
    type: string,
    params?: Record<string, unknown>
  ): Promise<{ ok: boolean; result: unknown }> {
    const response = await fetch(`${this.baseUrl}/api/debug/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type, params }),
    });
    const data = await response.json();
    return data;
  }

  async checkKB() {
    return this.query("kb-check");
  }

  async checkSalary() {
    return this.query("salary-check");
  }

  async checkEnv() {
    return this.query("env-check");
  }

  async checkMemory() {
    return this.query("memory-check");
  }

  async checkRoutes() {
    return this.query("routes-check");
  }

  async checkDiscrepancies() {
    return this.query("discrepancy-check");
  }

  startAutoRefresh(callback: (data: any) => void, intervalMs: number = 5000) {
    this.autoRefresh = true;
    this.refreshInterval = window.setInterval(async () => {
      try {
        const [logs, stats, discrepancies] = await Promise.all([
          this.getLogs({ limit: 20 }),
          this.getStats(),
          this.checkDiscrepancies(),
        ]);
        callback({ logs, stats, discrepancies });
      } catch (error) {
        console.error("Debug auto-refresh failed:", error);
      }
    }, intervalMs);
  }

  stopAutoRefresh() {
    this.autoRefresh = false;
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }
  }

  // Console integration
  attachToConsole() {
    (window as any).__WATANY_DEBUG__ = this;
    console.log(
      "%c🔍 Watany Debug Console Attached",
      "color: #00ff00; font-weight: bold; font-size: 14px;"
    );
    console.log(
      "%cAccess debug functions via: window.__WATANY_DEBUG__",
      "color: #00aaff; font-size: 12px;"
    );
    console.log(
      "%cAvailable commands:\n" +
        "  - __WATANY_DEBUG__.getLogs()\n" +
        "  - __WATANY_DEBUG__.getStats()\n" +
        "  - __WATANY_DEBUG__.checkKB()\n" +
        "  - __WATANY_DEBUG__.checkDiscrepancies()\n" +
        "  - __WATANY_DEBUG__.startAutoRefresh((data) => console.log(data))",
      "color: #ffffff; font-size: 11px;"
    );
  }
}

// Create and export singleton instance
export const debugClient = new DebugConsoleClient(
  "http://localhost:4001"
);

// Auto-attach in development mode
if (typeof window !== "undefined") {
  debugClient.attachToConsole();
}
