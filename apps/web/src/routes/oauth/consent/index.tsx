import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import ConsentContent from "@/components/connected-apps/consent-content";
import { connectedAppClientQuery } from "@/lib/queries/connected-apps";
import { teamsListQuery } from "@/lib/queries/teams";

// Every param is optional so a mangled URL renders an error card instead of
// failing route matching. The content checks what it needs.
const searchSchema = z.object({
  response_type: z.string().optional(),
  client_id: z.string().optional(),
  redirect_uri: z.string().optional(),
  state: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.string().optional(),
  resource: z.string().optional(),
  scope: z.string().optional(),
});

export const Route = createFileRoute("/oauth/consent/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ clientId: search.client_id, redirectUri: search.redirect_uri }),
  loader: ({ context: { queryClient }, deps: { clientId, redirectUri } }) => {
    void queryClient.prefetchQuery(teamsListQuery());
    if (clientId && redirectUri) {
      void queryClient.prefetchQuery(connectedAppClientQuery({ clientId, redirectUri }));
    }
  },
  component: ConsentPage,
});

function ConsentPage() {
  const search = Route.useSearch();
  return (
    <ConsentContent
      clientId={search.client_id}
      redirectUri={search.redirect_uri}
      state={search.state}
      codeChallenge={search.code_challenge}
      resource={search.resource}
      scope={search.scope}
    />
  );
}
