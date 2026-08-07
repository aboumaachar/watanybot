import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig, type ConfigEnv, type Plugin, type UserConfig } from "vite";
import baseConfig from "./vite.config";

const FINAL_CASCADE_BEGIN = "APEX_V119020_FINAL_CASCADE_BEGIN";
const FINAL_CASCADE_END = "APEX_V119020_FINAL_CASCADE_END";
const FINAL_CASCADE_PATH = fileURLToPath(
  new URL("./src/themes/watany-v1.19.0.20-final-cascade.css", import.meta.url),
);

function readFinalCascade(): string {
  const source = readFileSync(FINAL_CASCADE_PATH, "utf8").replace(/^\uFEFF/, "").trim();
  const beginCount = source.split(FINAL_CASCADE_BEGIN).length - 1;
  const endCount = source.split(FINAL_CASCADE_END).length - 1;
  if (beginCount !== 1 || endCount !== 1) {
    throw new Error("V1.19.0.20 final cascade markers are missing or duplicated");
  }
  if (/fonts\.(?:googleapis|gstatic)\.com/i.test(source)) {
    throw new Error("V1.19.0.20 final cascade contains an external font reference");
  }
  return source;
}

function finalCascadePlugin(): Plugin {
  const finalCascade = readFinalCascade();
  return {
    name: "apex-v119020-final-static-cascade",
    enforce: "post",
    generateBundle(_options, bundle) {
      const cssAssets = Object.values(bundle).filter(
        (entry) => entry.type === "asset" && entry.fileName.toLowerCase().endsWith(".css"),
      );
      if (cssAssets.length !== 1) {
        this.error(`V1.19.0.20 expected exactly one CSS asset; observed ${cssAssets.length}`);
      }
      const asset = cssAssets[0];
      if (asset.type !== "asset") {
        this.error("V1.19.0.20 CSS bundle selection was not an asset");
      }
      const existing = typeof asset.source === "string"
        ? asset.source
        : new TextDecoder().decode(asset.source);
      if (existing.includes(FINAL_CASCADE_BEGIN) || existing.includes(FINAL_CASCADE_END)) {
        this.error("V1.19.0.20 final cascade is already present in the generated CSS");
      }
      asset.source = `${existing.trimEnd()}\n\n${finalCascade}\n`;
    },
  };
}

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
  // Leave unrelated packages to Rollup. A catch-all vendor-common chunk formed a
  // circular vendor-common -> vendor-react -> vendor-common relationship in the
  // V1.19.0.15 evidence and produced release-blocking stderr.
  return undefined;
}

function manualChunks(id: string): string | undefined {
  return vendorChunk(id) || sourceChunk(id);
}

export default defineConfig(async (env: ConfigEnv) => {
  const source = typeof baseConfig === "function" ? await baseConfig(env) : await baseConfig;
  const splitConfig: UserConfig = {
    plugins: [finalCascadePlugin()],
    build: {
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
  };
  return mergeConfig(source, splitConfig);
});
