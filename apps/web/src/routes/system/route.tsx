import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { MetricsIntervalEnum } from "@/lib/queries/metrics";
import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";
import { metricsSearchParamKeys } from "@/components/metrics/constants";
import {
  ServerPanelTabEnum,
  serverPanelServerNameKey,
  serverPanelTabKey,
} from "@/components/system/servers/panel/constants";
import ServerPanelProvider from "@/components/system/servers/panel/server-panel-provider";
import SystemNavbar from "@/components/system/system-navbar";
import SystemProvider from "@/components/system/system-provider";
import { isSystemAdmin } from "@/lib/queries/me";
import { serversListQuery } from "@/lib/queries/servers";
import { systemQuery } from "@/lib/queries/system";

const searchSchema = z.object({
  // Server panel
  [serverPanelServerNameKey]: z.string().optional(),
  [serverPanelTabKey]: ServerPanelTabEnum.optional(),
  [metricsSearchParamKeys.server.interval]: MetricsIntervalEnum.optional(),
});

export const Route = createFileRoute("/system")({
  validateSearch: zodValidator(searchSchema),
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
      <ServerPanelProvider>
        <SystemNavbar />
        <Outlet />
        <NavbarSafeAreaInsetBottom className="sm:hidden" />
      </ServerPanelProvider>
    </SystemProvider>
  );
}
