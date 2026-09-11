import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";
import SystemNavbar from "@/components/system/system-navbar";
import SystemProvider from "@/components/system/system-provider";
import { isSystemAdmin } from "@/lib/queries/me";
import { serversListQuery } from "@/lib/queries/servers";
import { systemQuery } from "@/lib/queries/system";

export const Route = createFileRoute("/system")({
  beforeLoad: ({ context }) => {
    const me = "me" in context ? context.me : undefined;
    if (!isSystemAdmin(me)) {
      throw redirect({ to: "/" });
    }
  },
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(systemQuery());
    void queryClient.prefetchQuery(serversListQuery());
  },
  component: SystemLayout,
});

function SystemLayout() {
  return (
    <SystemProvider>
      <SystemNavbar />
      <Outlet />
      <NavbarSafeAreaInsetBottom className="sm:hidden" />
    </SystemProvider>
  );
}
