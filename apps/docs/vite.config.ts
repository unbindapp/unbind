import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { globSync } from "node:fs";

const contentPaths = globSync("**/*.mdx", { cwd: "content" }).map(contentFileToPath);

function contentFileToPath(file: string) {
  const segments = file
    .replace(/\.mdx$/, "")
    .split("/")
    .filter((segment) => !segment.startsWith("(") && segment !== "index");
  return `/${segments.join("/")}`;
}

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    fumadocsMdx(),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: true,
        crawlLinks: true,
      },
      pages: [
        ...contentPaths.map((path) => ({ path })),
        { path: "/search-index.json" },
        { path: "/llms-full.txt" },
        { path: "/llms.txt" },
        { path: "/sitemap.xml" },
      ],
    }),
    react(),
    nitro(),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: "tslib/tslib.es6.js",
    },
  },
});
