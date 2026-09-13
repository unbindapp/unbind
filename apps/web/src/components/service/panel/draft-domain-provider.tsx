"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

type TDraftDomainContext = {
  draftDomain: string | null;
  setDraftDomain: (domain: string | null) => void;
};

const DraftDomainContext = createContext<TDraftDomainContext | null>(null);

// The deploy form owns the domain an undeployed service will get, so the panel
// header reads it from here instead of the config the service was created with.
export const DraftDomainProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [draftDomain, setDraftDomain] = useState<string | null>(null);

  const value = useMemo(() => ({ draftDomain, setDraftDomain }), [draftDomain]);

  return <DraftDomainContext.Provider value={value}>{children}</DraftDomainContext.Provider>;
};

export const useDraftDomain = () => {
  const context = useContext(DraftDomainContext);
  if (!context) {
    throw new Error("useDraftDomain must be used within a DraftDomainProvider");
  }
  return context;
};

// Databases never publish one, they have no address until they are deployed.
export const usePublishDraftDomain = (domain: string | undefined) => {
  const { setDraftDomain } = useDraftDomain();

  useEffect(() => {
    setDraftDomain(domain || null);
    return () => setDraftDomain(null);
  }, [domain, setDraftDomain]);
};

export default DraftDomainProvider;
