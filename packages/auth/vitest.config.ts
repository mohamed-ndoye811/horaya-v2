import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Même base de test jetable que packages/db.
    globalSetup: ["../db/test/global-setup.ts"],
    fileParallelism: false,
  },
});
