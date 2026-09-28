import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

const servicesRouteId = "/$team_id/project/$project_id/";

type TProps = {
  teamId: string;
  projectId: string;
};

// Panels for new services, volumes and template drafts only render on the services page
export function useNavigateToServices({ teamId, projectId }: TProps) {
  const router = useRouter();

  return useCallback(
    async (environmentId: string) => {
      const isOnServicesPage = router.state.matches.some((m) => m.routeId === servicesRouteId);
      if (isOnServicesPage) return;

      await router.navigate({
        to: "/$team_id/project/$project_id",
        params: { team_id: teamId, project_id: projectId },
        search: { environment: environmentId },
      });
    },
    [router, teamId, projectId],
  );
}
