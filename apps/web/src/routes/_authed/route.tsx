import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { meQuery } from "@/api/auth";

/**
 * Pathless layout route guarding every authenticated area. Replaces the old
 * server-side session check / middleware. Children nest under this via the
 * `_authed/` directory.
 */
export const Route = createFileRoute("/_authed")({
  // NOT async. `beforeLoad` runs on every navigation; an async function always
  // returns a promise, which forces the router to resolve the navigation across
  // a microtask and commit a "pending" (suspended) frame before the page mounts
  // — that frame is the blank/skeleton flash. When `me` is already cached (every
  // client navigation after the first) we read it synchronously and the whole
  // navigation resolves in one tick, so the router never goes pending. Only the
  // cold first load returns a promise.
  beforeLoad: ({ context, location }) => {
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
  component: AuthedLayout,
});

function AuthedLayout() {
  return <Outlet />;
}
