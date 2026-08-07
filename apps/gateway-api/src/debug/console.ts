import fs from "node:fs";
import path from "node:path";

/**
 * Debug Console Utilities
 * Live error logging, performance monitoring, and query functions
 */

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: unknown;
  stack?: string;
}

interface PerformanceEntry {
  route: string;
  method: string;
  duration: number;
  timestamp: string;
  statusCode?: number;
}

class DebugConsole {
  private logs: LogEntry[] = [];
  private performance: PerformanceEntry[] = [];
  private readonly maxLogs = 1000;
  private readonly maxPerformance = 500;

  log(level: LogEntry["level"], message: string, data?: unknown, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: undefined,
      stack: undefined,
    };
    if (data !== undefined) entry.data = data;
    if (process.env.NODE_ENV !== "production" && error?.["stack"]) entry.stack = error["stack"];

    this.logs.push(entry);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output with color
    const colors = {
      info: "\x1b[36m",    // Cyan
      warn: "\x1b[33m",    // Yellow
      error: "\x1b[31m",   // Red
      debug: "\x1b[35m",   // Magenta
    };
    const reset = "\x1b[0m";
    
    console.log(
      `${colors[level]}[${level.toUpperCase()}]${reset} ${entry.timestamp} - ${message}`,
      data ?? ""
    );
    if (error?.stack) {
      if (process.env.NODE_ENV !== "production" && error?.["stack"]) console.log(`${colors.error}${error["stack"]}${reset}`);
    }
  }

  info(message: string, data?: unknown) {
    this.log("info", message, data);
  }

  warn(message: string, data?: unknown) {
    this.log("warn", message, data);
  }

  error(message: string, data?: unknown, error?: Error) {
    this.log("error", message, data, error);
  }

  debug(message: string, data?: unknown) {
    this.log("debug", message, data);
  }

  trackPerformance(entry: PerformanceEntry) {
    this.performance.push(entry);
    
    if (this.performance.length > this.maxPerformance) {
      this.performance.shift();
    }

    // Log slow requests
    if (entry.duration > 1000) {
      this.warn(`Slow request detected: ${entry.method} ${entry.route}`, {
        duration: `${entry.duration}ms`,
        statusCode: entry.statusCode,
      });
    }
  }

  getLogs(filter?: { level?: string; since?: Date; limit?: number }) {
    let filtered = [...this.logs];

    if (filter?.level) {
      filtered = filtered.filter(log => log.level === filter.level);
    }

    if (filter?.since) {
      filtered = filtered.filter(log => new Date(log.timestamp) >= filter.since!);
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  getPerformance(filter?: { route?: string; minDuration?: number; limit?: number }) {
    let filtered = [...this.performance];

    if (filter?.route) {
      filtered = filtered.filter(p => p.route.includes(filter.route!));
    }

    if (filter?.minDuration) {
      filtered = filtered.filter(p => p.duration >= filter.minDuration!);
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  getStats() {
    const logCounts = this.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgPerformance = this.performance.length > 0
      ? this.performance.reduce((sum, p) => sum + p.duration, 0) / this.performance.length
      : 0;

    const slowRequests = this.performance.filter(p => p.duration > 1000).length;

    return {
      totalLogs: this.logs.length,
      logCounts,
      totalRequests: this.performance.length,
      avgResponseTime: Math.round(avgPerformance),
      slowRequests,
    };
  }

  /**
   * Group error logs into a concise map to help operators triage issues.
   * Returns an array of { key, message, count, routes, lastSeen, samples }.
   */
  // Acknowledgement map persisted to disk for durability
  private acks: Record<string, { by?: string; at: string } | null> = {};
  private readonly acksFile = path.resolve(process.cwd(), "data", "debug_acks.json");

  private loadAcksFromDisk() {
    try {
      if (fs.existsSync(this.acksFile)) {
        const raw = fs.readFileSync(this.acksFile, "utf8");
        this.acks = JSON.parse(raw) as typeof this.acks;
      }
    } catch (e) {
      this.warn("Failed to load acks from disk", { err: (e as Error).message });
    }
  }

  private persistAcksToDisk() {
    try {
      const dir = path.dirname(this.acksFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.acksFile, JSON.stringify(this.acks, null, 2), "utf8");
    } catch (e) {
      this.warn("Failed to persist acks to disk", { err: (e as Error).message });
    }
  }

  constructor() {
    this.loadAcksFromDisk();
  }

  getErrorMap(filter?: { since?: Date; limitPerGroup?: number }) {
    const since = filter?.since;
    const limitPerGroup = filter?.limitPerGroup ?? 5;

    // Select only error-level logs (including uncaught/unhandled)
    const errorLogs = this.logs.filter(l => l.level === "error" && (!since || new Date(l.timestamp) >= since));

    const groups: Record<string, { message: string; count: number; routes: Set<string>; lastSeen: string; samples: LogEntry[] }> = {};

    for (const entry of errorLogs) {
      // Use message as grouping key, fall back to stack snippet
      const key = entry.message || (entry.stack ? entry.stack.split('\n')[0] : 'unknown_error');
      const route = (entry.data as any)?.route || (entry.data as any)?.requestUrl || 'unknown';

      if (!groups[key]) {
        groups[key] = { message: entry.message, count: 0, routes: new Set(), lastSeen: entry.timestamp, samples: [] };
      }

      const g = groups[key];
      g.count += 1;
      if (route) g.routes.add(route);
      if (new Date(entry.timestamp) > new Date(g.lastSeen)) g.lastSeen = entry.timestamp;
      if (g.samples.length < limitPerGroup) g.samples.push(entry);
    }

    // Convert sets to arrays and sort by count desc
    const mapped = Object.keys(groups).map((k) => ({
      key: k,
      message: groups[k].message,
      count: groups[k].count,
      routes: Array.from(groups[k].routes),
      lastSeen: groups[k].lastSeen,
      samples: groups[k].samples,
      acknowledged: !!this.acks[k],
      ack: this.acks[k] || null,
    })).sort((a, b) => b.count - a.count);

    return mapped;
  }

  // Acknowledge an error group (in-memory)
  ackError(key: string, by?: string) {
    this.acks[key] = { by: by || 'operator', at: new Date().toISOString() };
    this.persistAcksToDisk();
    this.info(`Error acknowledged: ${key}`, this.acks[key]);
    return this.acks[key];
  }

  // Remove acknowledgement
  unackError(key: string) {
    delete this.acks[key];
    this.persistAcksToDisk();
    this.info(`Error unacknowledged: ${key}`);
    return true;
  }

  // Return ack map
  getAcks() {
    return { ...this.acks };
  }

  clear() {
    this.logs = [];
    this.performance = [];
    this.info("Debug console cleared");
  }
}

export const debugConsole = new DebugConsole();

// Global error handlers
process.on("uncaughtException", (error) => {
  debugConsole.error("Uncaught Exception", { error: error.message }, error);
});

process.on("unhandledRejection", (reason, promise) => {
  debugConsole.error("Unhandled Rejection", { reason, promise });
});

