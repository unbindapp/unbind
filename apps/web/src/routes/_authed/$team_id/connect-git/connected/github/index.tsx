import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import GithubConnectedContent from "@/components/git/github-connected-content";

export const Route = createFileRoute("/_authed/$team_id/connect-git/connected/github/")({
  validateSearch: zodValidator(z.object({ id: z.string().optional() })),
  component: GithubCallbackPage,
});

function GithubCallbackPage() {
  const { id } = Route.useSearch();
  return <GithubConnectedContent id={id ?? ""} />;
}
