import Providers from "@/components/providers/providers";
import NotFoundTemplate from "@/components/navigation/not-found-template";
import { meQuery } from "@/api/auth";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { TriangleAlertIcon } from "lucide-react";

export type RouterContext = {
  queryClient: QueryClient;
};

// Routes reachable while signed out. Everything else (incl. /sign-out) requires auth.
const PUBLIC_PATHS = new Set(["/sign-in", "/welcome"]);

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: ({ context, location }) => {
    if (PUBLIC_PATHS.has(location.pathname)) return;

    const cached = context.queryClient.getQueryData(meQuery.queryKey);
    if (cached !== undefined) {
      if (!cached) {
        throw redirect({ to: "/sign-in", search: { redirect: location.href } });
      }
      return { me: cached };
    }
    return context.queryClient.ensureQueryData(meQuery).then((me) => {
      if (!me) {
        throw redirect({ to: "/sign-in", search: { redirect: location.href } });
      }
      return { me };
    });
  },
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
