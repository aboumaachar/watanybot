import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const webUserOrigin = env.VITE_WEB_USER_ORIGIN || "http://127.0.0.1:5174";
  const adminPort = Number(env.VITE_PORT || 5175);
  return {
    plugins: [react()],
    base: env.VITE_BASE || "/",
    server: {
      port: adminPort,
      proxy: {
        "/school-grants": {
          target: webUserOrigin,
          changeOrigin: true,
        },
        "/school-aids": {
          target: webUserOrigin,
          changeOrigin: true,
        },
      },
    },
  };
});

