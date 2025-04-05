"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";

type TAppConfigContext = {
  apiUrl: string;
  siteUrl: string;
};

const AppConfigContext = createContext<TAppConfigContext | null>(null);

export const AppConfigProvider: React.FC<{
  apiUrl: string;
  siteUrl: string;
  children: ReactNode;
}> = ({ apiUrl, siteUrl, children }) => {
  const value: TAppConfigContext = useMemo(
    () => ({
      apiUrl,
      siteUrl,
    }),
    [apiUrl, siteUrl],
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
};

export const useAppConfig = () => {
  const context = useContext(AppConfigContext);
  if (!context) {
    throw new Error("useAppConfig must be used within an AppConfigProvider");
  }
  return context;
};

export default AppConfigProvider;
