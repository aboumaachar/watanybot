import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

function toChunkSafeName(value: string): string {
  return value.replace(/^@/, "").replaceAll("/", "-");
}

function getNodeModulePackageName(id: string): string | null {
  const normalizedId = id.replaceAll("\\", "/");
  const marker = "/node_modules/";
  const markerIndex = normalizedId.lastIndexOf(marker);
  if (markerIndex === -1) return null;
  const packagePath = normalizedId.slice(markerIndex + marker.length);
  const segments = packagePath.split("/");
  if (segments.length === 0) return null;
  if (segments[0].startsWith("@") && segments.length > 1) {
    return `${segments[0]}/${segments[1]}`;
  }
  return segments[0] || null;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET || env.VITE_API_URL || "http://127.0.0.1:8010";
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

  return {
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true,
      host: "127.0.0.1",
      fs: {
        allow: [repoRoot, path.resolve(repoRoot, "..")] 
      },
      proxy: {
        "/api": {
          target: devProxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: false, // Disabled for production (smaller builds, faster)
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replaceAll("\\", "/");

            if (normalizedId.includes("/src/lib/api.ts")) {
              return "app-api";
            }

            if (normalizedId.includes("/src/config/koudamaIconAssignments.generated.ts")) {
              return "app-icon-assignments";
            }

            const packageName = getNodeModulePackageName(id);
            if (!packageName) return undefined;

            if (packageName === "react" || packageName === "react-dom") {
              return "vendor-react";
            }

            if (packageName === "react-router-dom") {
              return "vendor-router";
            }

            if (
              packageName === "@fluentui/react-icons" ||
              packageName.startsWith("@griffel/") ||
              packageName === "@emotion/hash" ||
              packageName === "rtl-css-js" ||
              packageName === "stylis"
            ) {
              return "vendor-icons";
            }

            return `vendor-${toChunkSafeName(packageName)}`;
          },
        },
      },
      chunkSizeWarningLimit: 550,
    },
    base: env.VITE_BASE || "/",
    preview: {
      port: 4173,
      host: "127.0.0.1",
      strictPort: true,
    },
  };
});

