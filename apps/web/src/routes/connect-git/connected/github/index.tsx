import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import GithubConnectedContent, {
  GithubSaveContent,
} from "@/components/git/github-connected-content";

export const Route = createFileRoute("/connect-git/connected/github/")({
  validateSearch: zodValidator(
    z.object({
      id: z.string().optional(),
      code: z.string().optional(),
      state: z.string().optional(),
    }),
  ),
  component: GithubCallbackPage,
});

function GithubCallbackPage() {
  const { id, code, state } = Route.useSearch();
  if (code && state) return <GithubSaveContent code={code} state={state} />;
  return <GithubConnectedContent id={id ?? ""} />;
}
