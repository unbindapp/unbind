import { createFileRoute, redirect } from "@tanstack/react-router";

// The update page moved under /system; old links and bookmarks land here.
export const Route = createFileRoute("/update/")({
  beforeLoad: () => {
    throw redirect({ to: "/system/update", replace: true });
  },
});
