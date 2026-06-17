import Providers from "@/components/providers/providers";
import NotFoundTemplate from "@/components/navigation/not-found-template";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { TriangleAlertIcon } from "lucide-react";

export type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { title: "Unbind | Self-hosting done right" },
      { name: "description", content: "Self-hosting done right." },
      // Open Graph
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Unbind | Self-hosting done right" },
      { property: "og:description", content: "Self-hosting done right." },
      { property: "og:image", content: "/previews/v1/home.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      // Twitter
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Unbind | Self-hosting done right" },
      { name: "twitter:description", content: "Self-hosting done right." },
      { name: "twitter:image", content: "/previews/v1/home.png" },
    ],
    links: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-64.png", type: "image/png", sizes: "64x64" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => (
    <NotFoundTemplate
      code={404}
      description="Not found."
      buttonText="Go Home"
      buttonTo="/"
      Icon={TriangleAlertIcon}
    />
  ),
  errorComponent: ({ error }) => (
    <NotFoundTemplate
      code={500}
      description={error instanceof Error ? error.message : "Something went wrong."}
      buttonText="Go Home"
      buttonTo="/"
      Icon={TriangleAlertIcon}
    />
  ),
});

function RootComponent() {
  return (
    <Providers>
      <HeadContent />
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </Providers>
  );
}
