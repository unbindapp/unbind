import Providers from "@/components/providers/providers";
import NotFoundTemplate from "@/components/navigation/not-found-template";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { TriangleAlertIcon } from "lucide-react";

export type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
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
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </Providers>
  );
}
