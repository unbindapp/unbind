"use client";

import { createContext, ReactNode, useContext } from "react";
import { useMediaQuery } from "usehooks-ts";

type TDeviceTypeContext = {
  isTouchscreen: boolean;
};

const DeviceTypeContext = createContext<TDeviceTypeContext | null>(null);

export const DeviceTypeProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const isTouchscreen = useMediaQuery("(pointer: coarse)");

  return (
    <DeviceTypeContext.Provider
      value={{
        isTouchscreen,
      }}
    >
      {children}
    </DeviceTypeContext.Provider>
  );
};

export const useDeviceType = () => {
  const context = useContext(DeviceTypeContext);
  if (!context) {
    throw new Error("useDeviceType must be used within an DeviceTypeProvider");
  }
  return context;
};

export default DeviceTypeProvider;
