import { defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Dev API target. Defaults to the hosted API; point VITE_DEV_API_PROXY at a local
// `go run ./cmd/api` (http://localhost:8089) for full-stack dev. The merged image
// serves the API under /api/go and /api/oauth2; the deployed ingress strips those
// prefixes, so the proxy strips them here too and the API receives root paths.
const apiTarget = process.env.VITE_DEV_API_PROXY ?? "https://api.unbind.app";

// https://vite.dev/config/
export default defineConfig({
  // Resolves the "@/*" path alias from tsconfig.json natively (Vite 8+).
  resolve: { tsconfigPaths: true },
  // Dev only: proxy the API prefixes so the browser talks to the API same-origin.
  // The session cookie comes back rewritten to a host-only (localhost) cookie, so it's
  // first-party — sidestepping the cross-site SameSite/CORS issues that otherwise drop
  // the auth cookie. In dev, config.ts sets apiUrl to "/api/go".
  server: {
    proxy: {
      "/api/go": {
        target: apiTarget,
        changeOrigin: true,
        secure: true,
        // Forward websocket upgrades (e.g. the pod terminal at /terminal/exec) too.
        ws: true,
        cookieDomainRewrite: "",
        rewrite: (path) => path.replace(/^\/api\/go/, ""),
      },
      "/api/oauth2": {
        target: apiTarget,
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: "",
        rewrite: (path) => path.replace(/^\/api\/oauth2/, ""),
      },
    },
  },
  plugins: [
    // Generates src/routeTree.gen.ts from the file-based routes in src/routes.
    // autoCodeSplitting is OFF on purpose: when on, each route's component is a
    // separate JS chunk, so navigating to a route whose chunk isn't loaded yet
    // (e.g. clicking the logo from a project page to the team page) makes the
    // router suspend on the async chunk download — a blank flash before the page
    // mounts. Bundling all route code keeps every client navigation synchronous
    // so pages render instantly with their own skeleton states, never a blank.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
});
