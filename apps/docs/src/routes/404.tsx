import { createFileRoute } from "@tanstack/react-router";
import { NotFound, notFoundHead } from "@/components/not-found";

// Prerendered so the static server has a page to answer unknown URLs with.
export const Route = createFileRoute("/404")({
  component: NotFound,
  head: () => notFoundHead,
});
