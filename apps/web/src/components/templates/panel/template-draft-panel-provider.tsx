"use client";

import { templateDraftPanelTemplateDraftIdKey } from "@/components/templates/panel/constants";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { createContext, ReactNode, useCallback, useContext, useMemo } from "react";

const routeApi = getRouteApi("/$team_id/project/$project_id");

type TTemplateDraftPanelContext = {
  currentTemplateDraftId: string | null;
  closePanel: () => void;
  openPanel: (templateDraftId: string) => void;
};

const TemplateDraftPanelContext = createContext<TTemplateDraftPanelContext | null>(null);

export const TemplateDraftPanelProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const navigate = useNavigate();
  const currentTemplateDraftId = routeApi.useSearch({
    select: (s) => s[templateDraftPanelTemplateDraftIdKey] ?? null,
  });
  const setCurrentTemplateDraftId = useCallback(
    (value: string | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [templateDraftPanelTemplateDraftIdKey]: value ?? undefined }),
        replace: true,
        resetScroll: false,
      }),
    [navigate],
  );

  const value: TTemplateDraftPanelContext = useMemo(
    () => ({
      currentTemplateDraftId,
      openPanel: (templateDraftId: string) => {
        setCurrentTemplateDraftId(templateDraftId);
      },
      closePanel: () => {
        setCurrentTemplateDraftId(null);
      },
    }),
    [currentTemplateDraftId, setCurrentTemplateDraftId],
  );

  return (
    <TemplateDraftPanelContext.Provider value={value}>
      {children}
    </TemplateDraftPanelContext.Provider>
  );
};

export const useTemplateDraftPanel = () => {
  const context = useContext(TemplateDraftPanelContext);
  if (!context) {
    throw new Error("useTemplateDraftPanel must be used within an TemplateDraftPanelProvider");
  }
  return context;
};

export default TemplateDraftPanelProvider;
