"use client";

import { usePathname } from "next/navigation";
import { useQueryState } from "nuqs";

export function useAppPathnames() {
  const pathname = usePathname();
  const pathnameArr = pathname.split("/");

  const teamId = pathnameArr.length > 1 ? pathnameArr[1] : undefined;
  const projectId = pathnameArr.length > 3 ? pathnameArr[3] : undefined;
  const environmentId = pathnameArr.length > 5 ? pathnameArr[5] : undefined;
  const [serviceId] = useQueryState("service_id");

  return {
    teamId,
    projectId,
    environmentId,
    serviceId: serviceId || undefined,
  };
}
