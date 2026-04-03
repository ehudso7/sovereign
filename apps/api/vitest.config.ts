import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@sovereign/db/test-harness",
        replacement: fromRoot("../../packages/db/src/__tests__/integration/db-test-harness.ts"),
      },
      { find: "@sovereign/core", replacement: fromRoot("../../packages/core/src/index.ts") },
      { find: "@sovereign/db", replacement: fromRoot("../../packages/db/src/index.ts") },
      { find: "@sovereign/gateway-mcp", replacement: fromRoot("../gateway-mcp/src/index.ts") },
    ],
  },
});
