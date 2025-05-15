"use client";

import { templateDraftPanelTemplateDraftIdKey } from "@/components/templates/panel/constants";
import { useQueryState } from "nuqs";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TTemplateDraftPanelContext = {
  currentTemplateDraftId: string | null;
  closePanel: () => void;
  openPanel: (templateDraftId: string) => void;
};

const TemplateDraftPanelContext = createContext<TTemplateDraftPanelContext | null>(null);

export const TemplateDraftPanelProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [currentTemplateDraftId, setCurrentTemplateDraftId] = useQueryState(
    templateDraftPanelTemplateDraftIdKey,
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
