"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "usehooks-ts";

type TDeviceTypeContext = {
  isTouchscreen: boolean;
};

const DeviceTypeContext = createContext<TDeviceTypeContext | null>(null);

export const DeviceTypeProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const isTouchscreen = useMediaQuery("(pointer: coarse)");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setMounted(true);
  }, []);

  const value: TDeviceTypeContext = useMemo(
    () => ({
      isTouchscreen: mounted ? isTouchscreen : false,
    }),
    [isTouchscreen, mounted],
  );

  return <DeviceTypeContext.Provider value={value}>{children}</DeviceTypeContext.Provider>;
};

export const useDeviceType = () => {
  const context = useContext(DeviceTypeContext);
  if (!context) {
    throw new Error("useDeviceType must be used within an DeviceTypeProvider");
  }
  return context;
};

export default DeviceTypeProvider;
