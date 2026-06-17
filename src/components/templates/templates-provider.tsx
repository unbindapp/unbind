"use client";

import { type TTemplatesList } from "@/api/services/templates";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TTemplatesContext = { data: TTemplatesList };

const TemplatesContext = createContext<TTemplatesContext | null>(null);

type TProps = {
  data: TTemplatesList;
  children: ReactNode;
};

export const TemplatesProvider: React.FC<TProps> = ({ data, children }) => {
  const value: TTemplatesContext = useMemo(() => ({ data }), [data]);

  return <TemplatesContext.Provider value={value}>{children}</TemplatesContext.Provider>;
};

export const useTemplates = () => {
  const context = useContext(TemplatesContext);
  if (!context) {
    throw new Error("useTemplates must be used within an TemplatesProvider");
  }
  return context;
};

export default TemplatesProvider;
