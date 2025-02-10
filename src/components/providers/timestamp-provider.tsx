"use client";

import { createContext, ReactNode, useContext, useState } from "react";
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

  return (
    <TimestampContext.Provider
      value={{
        timestamp,
      }}
    >
      {children}
    </TimestampContext.Provider>
  );
};

export const useTimestamp = () => {
  const context = useContext(TimestampContext);
  if (!context) {
    throw new Error("useTimestamp must be used within an TimestampProvider");
  }
  return context;
};

export default TimestampProvider;
