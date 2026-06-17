"use client";

import { templatesListQuery, type TTemplatesList } from "@/api/queries/templates";
import { useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TTemplatesContext = { data: TTemplatesList };

const TemplatesContext = createContext<TTemplatesContext | null>(null);

type TProps = {
  initialData?: TTemplatesList;
  children: ReactNode;
};

export const TemplatesProvider: React.FC<TProps> = ({ initialData, children }) => {
  // Self-fetches so the layout can mount without blocking on this query; the
  // command panel that consumes it just shows nothing until templates arrive.
  const { data } = useQuery({ ...templatesListQuery(), initialData });
  const value: TTemplatesContext = useMemo(() => ({ data: data ?? { templates: [] } }), [data]);

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
