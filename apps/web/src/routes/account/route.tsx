import { createFileRoute, Outlet } from "@tanstack/react-router";

import AccountNavbar from "@/components/account/account-navbar";
import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";

export const Route = createFileRoute("/account")({
  component: AccountLayout,
});

function AccountLayout() {
  return (
    <>
      <AccountNavbar />
      <Outlet />
      <NavbarSafeAreaInsetBottom className="sm:hidden" />
      <ContextCommandPanel
        title="Account Command Panel"
        description="Account command panel"
        context={{ contextType: "account" }}
        triggerType="layout"
      />
    </>
  );
}
