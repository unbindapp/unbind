"use client";

import { createContext, ReactNode, useContext, useState } from "react";
import { useInterval } from "usehooks-ts";

type TNowContext = number;

const NowContext = createContext<TNowContext | null>(null);

export const NowProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [now, setNow] = useState(Date.now());

  useInterval(() => {
    setNow(Date.now());
  }, 1000);

  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
};

export const useNow = () => {
  const context = useContext(NowContext);
  if (!context) {
    throw new Error("useNow must be used within an NowProvider");
  }
  return context;
};

export default NowProvider;
