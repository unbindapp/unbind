import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { meQuery } from "@/api/auth";

/**
 * Pathless layout route guarding every authenticated area. Replaces the old
 * server-side session check / middleware. Children nest under this via the
 * `_authed/` directory.
 */
export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
    return { me };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return <Outlet />;
}
