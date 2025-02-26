"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";
import { useIsMounted, useWindowSize } from "usehooks-ts";

type TDeviceSizeContext = {
  size: "xs" | "sm" | "md" | "lg" | "xl";
  isExtraSmall: boolean;
};

const DeviceSizeContext = createContext<TDeviceSizeContext | null>(null);

export const DeviceSizeProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const mounted = useIsMounted();
  const { width } = useWindowSize();
  const size = mounted()
    ? width < 640
      ? "xs"
      : width < 768
      ? "sm"
      : width < 1024
      ? "md"
      : width < 1280
      ? "lg"
      : "xl"
    : "xl";

  const value: TDeviceSizeContext = useMemo(
    () => ({
      size,
      isExtraSmall: size === "xs",
    }),
    [size]
  );

  return (
    <DeviceSizeContext.Provider value={value}>
      {children}
    </DeviceSizeContext.Provider>
  );
};

export const useDeviceSize = () => {
  const context = useContext(DeviceSizeContext);
  if (!context) {
    throw new Error("useDeviceSize must be used within an DeviceSizeProvider");
  }
  return context;
};

export default DeviceSizeProvider;
