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
