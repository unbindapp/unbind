import type { FileRouteTypes } from "@/routeTree.gen";
import { useMatchRoute } from "@tanstack/react-router";

// Sections that sit outside the team and project tree, so they need a way back home.
const awayFromHomeRoutes = ["/system"] as const satisfies readonly FileRouteTypes["to"][];

export function useIsAwayFromHome() {
  const matchRoute = useMatchRoute();
  return awayFromHomeRoutes.some((to) => Boolean(matchRoute({ to, fuzzy: true })));
}
