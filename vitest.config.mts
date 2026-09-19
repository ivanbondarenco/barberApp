import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Los módulos de servidor importan "server-only"; en tests unitarios se reemplaza por un módulo vacío.
      "server-only": path.resolve(import.meta.dirname, "tests/unit/support/server-only.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/server/**"],
      exclude: ["src/lib/mock-data.ts", "src/lib/motion.ts", "src/lib/calendar.ts"],
    },
  },
});
