"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { useInterval } from "usehooks-ts";

type TTimestampContext = {
  timestamp: number;
};

const TimestampContext = createContext<TTimestampContext | null>(null);

export const TimestampProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [timestamp, setTimestamp] = useState(Date.now());

  useInterval(() => {
    setTimestamp(Date.now());
  }, 1000);

  const value: TTimestampContext = useMemo(
    () => ({
      timestamp,
    }),
    [timestamp],
  );

  return <TimestampContext.Provider value={value}>{children}</TimestampContext.Provider>;
};

export const useTimestamp = () => {
  const context = useContext(TimestampContext);
  if (!context) {
    throw new Error("useTimestamp must be used within an TimestampProvider");
  }
  return context;
};

export default TimestampProvider;
