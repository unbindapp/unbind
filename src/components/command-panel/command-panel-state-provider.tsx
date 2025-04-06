"use client";

import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useMemo,
  useState,
} from "react";

type TCommandPanelStateContext = {
  isPendingId: string | null;
  setIsPendingId: Dispatch<SetStateAction<string | null>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
};

const CommandPanelStateContext = createContext<TCommandPanelStateContext | null>(null);

export const CommandPanelStateProvider: React.FC<{
  children: ReactNode;
  isPendingId?: string | null;
}> = ({ isPendingId: isPendingIdProp, children }) => {
  const [search, setSearch] = useState("");
  const [isPendingId, setIsPendingId] = useState(isPendingIdProp || null);

  const value: TCommandPanelStateContext = useMemo(
    () => ({
      isPendingId,
      setIsPendingId,
      search,
      setSearch,
    }),
    [isPendingId, search],
  );

  return (
    <CommandPanelStateContext.Provider value={value}>{children}</CommandPanelStateContext.Provider>
  );
};

export const useCommandPanelState = () => {
  const context = useContext(CommandPanelStateContext);
  if (!context) {
    throw new Error("useCommandPanelState must be used within an CommandPanelStateProvider");
  }
  return context;
};
