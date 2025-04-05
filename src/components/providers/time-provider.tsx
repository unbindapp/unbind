"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { useInterval } from "usehooks-ts";

type TTimeContext = {
  now: number;
};

const TimeContext = createContext<TTimeContext | null>(null);

export const TimeProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [now, setNow] = useState(Date.now());

  useInterval(() => {
    setNow(Date.now());
  }, 1000);

  const value: TTimeContext = useMemo(
    () => ({
      now,
    }),
    [now],
  );

  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
};

export const useTime = () => {
  const context = useContext(TimeContext);
  if (!context) {
    throw new Error("useTime must be used within an TimeProvider");
  }
  return context;
};

export default TimeProvider;
