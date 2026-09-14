import { createFileRoute, redirect } from "@tanstack/react-router";

// Settings is the only tab for now, so the bare route goes straight there.
export const Route = createFileRoute("/account/")({
  beforeLoad: () => {
    throw redirect({ to: "/account/settings" });
  },
});
