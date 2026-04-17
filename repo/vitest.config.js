import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./unit_tests/testSetup.js"],
    exclude: ["e2e_tests/**", "node_modules/**"],
  },
});
