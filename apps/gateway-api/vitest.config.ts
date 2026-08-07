import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: [],
    env: {
      JWT_SECRET: "TEST_ONLY_FAKE_JWT_SECRET_DO_NOT_USE_IN_PROD",
      USE_PYTHON_API: "true",
      PYTHON_API_URL: "http://localhost:8012",
      PORT: "4000",
      USE_KB_STUB: "false",
      RUN_PG_MIGRATIONS: "false",
      DISABLE_PLUGIN_DB: "true",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/types/**",
        "node_modules/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
