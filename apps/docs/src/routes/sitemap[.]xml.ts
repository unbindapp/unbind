import { createFileRoute } from "@tanstack/react-router";
import { source } from "@/lib/source";
import { siteUrl } from "@/lib/shared";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const urls = source
          .getPages()
          .map((page) => `<url><loc>${siteUrl}${page.url === "/" ? "" : page.url}</loc></url>`);

        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`,
          { headers: { "Content-Type": "application/xml" } },
        );
      },
    },
  },
});
