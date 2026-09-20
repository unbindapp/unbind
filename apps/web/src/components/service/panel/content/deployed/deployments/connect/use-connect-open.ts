"use client";

import { servicePanelConnectKey } from "@/components/service/panel/constants";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";

// Open state of the Connect card. It lives in the URL while the panel is open and the
// panel remembers it per service (see servicePanelOwnedSearchKeys), so a database the
// user expanded once opens expanded again. Collapsed is the default, so writing false
// drops the key (see the project route's search middleware).
export function useConnectOpen() {
  const navigate = useNavigate();

  const isOpen = useSearch({
    strict: false,
    select: (s) => (s as Record<string, unknown>)[servicePanelConnectKey] === true,
  });

  const setIsOpen = useCallback(
    (value: boolean) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [servicePanelConnectKey]: value }),
        replace: true,
        resetScroll: false,
      }),
    [navigate],
  );

  return { isOpen, setIsOpen };
}
