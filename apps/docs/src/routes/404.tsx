import { createFileRoute } from "@tanstack/react-router";
import { NotFound } from "@/components/not-found";
import { appName } from "@/lib/shared";

// Prerendered so the static server has a page to answer unknown URLs with.
export const Route = createFileRoute("/404")({
  component: NotFound,
  head: () => ({
    meta: [{ title: `Page not found | ${appName} Docs` }, { name: "robots", content: "noindex" }],
  }),
});
