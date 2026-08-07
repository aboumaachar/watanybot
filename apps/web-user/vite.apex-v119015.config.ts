import { defineConfig, mergeConfig, type ConfigEnv, type UserConfig } from "vite";
import baseConfig from "./vite.config";

function cleanChunkName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function sourceChunk(id: string): string | undefined {
  const normalized = id.replace(/\\/g, "/").split("?")[0];
  const sourceMarker = "/src/";
  const sourceIndex = normalized.lastIndexOf(sourceMarker);
  if (sourceIndex < 0) return undefined;

  const sourcePath = normalized.slice(sourceIndex + sourceMarker.length);
  const parts = sourcePath.split("/");
  const top = parts[0];

  if (top === "pages") {
    return `route-${cleanChunkName(parts[1] || "pages")}`;
  }

  if (top === "features") {
    return `feature-${cleanChunkName(parts[1] || "shared")}`;
  }

  if (top === "components" && parts.length > 2) {
    const group = parts[1];
    if (["admin", "chat", "procedures", "viewer-parity", "worldcup"].includes(group)) {
      return `component-${cleanChunkName(group)}`;
    }
  }

  if (top === "data") return "app-data";
  if (top === "lib") return "app-lib";
  return undefined;
}

function vendorChunk(id: string): string | undefined {
  const normalized = id.replace(/\\/g, "/");
  if (!normalized.includes("/node_modules/")) return undefined;

  if (/\/node_modules\/(react|react-dom|react-router|react-router-dom)\//.test(normalized)) {
    return "vendor-react";
  }
  if (normalized.includes("/node_modules/@fluentui/")) return "vendor-fluent";
  if (normalized.includes("/node_modules/framer-motion/")) return "vendor-motion";
  if (/\/node_modules\/(zod|react-hook-form|@hookform)\//.test(normalized)) return "vendor-forms";
  if (/\/node_modules\/(date-fns|dayjs|luxon)\//.test(normalized)) return "vendor-dates";
  if (/\/node_modules\/(recharts|d3-|chart.js)\//.test(normalized)) return "vendor-charts";
  // Let Rollup decide for remaining dependencies to avoid circular manual chunk graphs.
  return undefined;
}

function manualChunks(id: string): string | undefined {
  return vendorChunk(id) || sourceChunk(id);
}

export default defineConfig(async (env: ConfigEnv) => {
  const source = typeof baseConfig === "function" ? await baseConfig(env) : await baseConfig;
  const splitConfig: UserConfig = {
    build: {
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
  };
  return mergeConfig(source, splitConfig);
});
