"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type TLogViewDropdownContext = [boolean, (open: boolean | ((open: boolean) => boolean)) => void];

const LogViewDropdownContext = createContext<TLogViewDropdownContext | null>(null);

export const LogViewDropdownProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [open, setOpen] = useState(false);

  const value: TLogViewDropdownContext = useMemo(() => [open, setOpen], [open, setOpen]);

  return (
    <LogViewDropdownContext.Provider value={value}>{children}</LogViewDropdownContext.Provider>
  );
};

export const useLogViewDropdown = () => {
  const context = useContext(LogViewDropdownContext);
  if (!context) {
    throw new Error("useLogViewDropdown must be used within an LogViewDropdownProvider");
  }
  return context;
};

export default LogViewDropdownProvider;
