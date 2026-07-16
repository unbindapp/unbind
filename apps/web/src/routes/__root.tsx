import Providers from "@/components/providers/providers";
import NotFoundTemplate from "@/components/navigation/not-found-template";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
/* import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"; */
import { TriangleAlertIcon } from "lucide-react";
import { z } from "zod";
import { commandPanelKey, commandPanelPageKey } from "@/components/command-panel/constants";
import useKeyboardInsetHeight from "@/lib/hooks/use-keyboard-inset-height";
import { meQuery } from "@/lib/queries/me";

export type RouterContext = {
  queryClient: QueryClient;
};

// The command panel renders across the whole app (team and project areas), so its
// search params live on the root route — the only common ancestor.
const searchSchema = z.object({
  [commandPanelKey]: z.string().optional(),
  [commandPanelPageKey]: z.string().optional(),
  highlight_id: z.string().optional(),
});

// Routes reachable while signed out. Everything else requires auth.
const PUBLIC_PATHS = new Set(["/sign-in", "/welcome"]);

export const Route = createRootRouteWithContext<RouterContext>()({
  validateSearch: zodValidator(searchSchema),
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
  useKeyboardInsetHeight();
  return (
    <Providers>
      <Outlet />
      {/*    {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />} */}
    </Providers>
  );
}
