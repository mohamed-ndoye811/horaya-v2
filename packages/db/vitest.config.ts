import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // Les tests partagent une base : on les exécute dans un seul worker.
    fileParallelism: false,
  },
});
