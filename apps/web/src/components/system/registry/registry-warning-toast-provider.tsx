"use client";

import { useMainStore } from "@/components/stores/main/main-store-provider";
import { getRegistryWarning } from "@/components/system/registry/helpers";
import { LinkButton } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useMounted } from "@/lib/hooks/use-mounted";
import { isSystemAdmin, meQuery } from "@/lib/queries/me";
import { registryStatsQuery } from "@/lib/queries/system";
import { useQuery } from "@tanstack/react-query";
import { ReactNode, useEffect, useRef } from "react";

const toastId = "registry_warning_toast";
const dismissForMs = 24 * 60 * 60 * 1000;
const staleTimeMs = 5 * 60 * 1000;

// Stands in for notifications until they exist: admins hear about a full registry before builds fail
export default function RegistryWarningToastProvider({ children }: { children: ReactNode }) {
  const { data: me } = useQuery(meQuery);
  const { data } = useQuery({
    ...registryStatsQuery(),
    enabled: isSystemAdmin(me),
    staleTime: staleTimeMs,
  });

  const dismissedAt = useMainStore((s) => s.registryWarningDismissedAt);
  const setDismissedAt = useMainStore((s) => s.setRegistryWarningDismissedAt);

  const mounted = useMounted();
  const shownRef = useRef(false);

  const warning = data ? getRegistryWarning(data.data) : null;

  useEffect(() => {
    if (!mounted || !warning || shownRef.current) return;
    if (dismissedAt !== null && Date.now() - dismissedAt < dismissForMs) return;

    toast.add({
      type: warning.level === "critical" ? "error" : "warning",
      title: warning.title,
      id: toastId,
      description: warning.description,
      data: {
        action: (
          <LinkButton
            onClick={() => {
              toast.close(toastId);
              setDismissedAt(Date.now());
            }}
            to="/system/settings/registry"
            size="sm"
          >
            Open
          </LinkButton>
        ),
      },
      onClose: () => {
        setDismissedAt(Date.now());
      },
    });

    shownRef.current = true;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warning?.title, mounted]);

  return children;
}
