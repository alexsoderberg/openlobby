/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev only: /api on the Vite origin is forwarded to the gateway. Production has no proxy,
// because edge routes /api to the gateway.
export default defineConfig(({ command, mode }) => {
  const gatewayUrl = process.env.GATEWAY_URL;
  if (command === "serve" && mode !== "test" && !gatewayUrl) {
    throw new Error(
      "GATEWAY_URL is not set. Set it to the gateway address, for example http://localhost:8080, before running npm run dev.",
    );
  }

  return {
    plugins: [react()],
    server: { proxy: gatewayUrl ? { "/api": gatewayUrl } : undefined },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
    },
  };
});
