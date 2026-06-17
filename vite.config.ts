import { defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  // Resolves the "@/*" path alias from tsconfig.json natively (Vite 8+).
  resolve: { tsconfigPaths: true },
  // Dev only: proxy "/api/*" to the real API so the browser talks to it same-origin.
  // The session cookie comes back rewritten to a host-only (localhost) cookie, so it's
  // first-party — sidestepping the cross-site SameSite/CORS issues that otherwise drop
  // the auth cookie. In dev, config.ts sets apiUrl to "/api".
  server: {
    proxy: {
      "/api": {
        target: "https://api.unbind.app",
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: "",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  plugins: [
    // Generates src/routeTree.gen.ts from the file-based routes in src/routes
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
});
