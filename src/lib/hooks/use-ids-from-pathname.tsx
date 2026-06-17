import { useLocation } from "@tanstack/react-router";

export function useIdsFromPathname() {
  const location = useLocation();
  const pathnameArr = location.pathname.split("/");

  const teamId = pathnameArr.length > 1 ? pathnameArr[1] : undefined;
  const projectId = pathnameArr.length > 3 ? pathnameArr[3] : undefined;

  const search = location.search as { environment?: string; service?: string };

  return {
    teamId,
    projectId,
    environmentId: search.environment ?? null,
    serviceId: search.service || undefined,
  };
}
