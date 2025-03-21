"use client";

import { usePathname } from "next/navigation";
import { useQueryState } from "nuqs";

export function useIdsFromPathname() {
  const pathname = usePathname();
  const pathnameArr = pathname.split("/");

  const teamId = pathnameArr.length > 1 ? pathnameArr[1] : undefined;
  const projectId = pathnameArr.length > 3 ? pathnameArr[3] : undefined;
  const [environmentId] = useQueryState("environment");
  const [serviceId] = useQueryState("service");

  return {
    teamId,
    projectId,
    environmentId,
    serviceId: serviceId || undefined,
  };
}
