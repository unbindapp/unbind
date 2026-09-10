import {
  matchSettings,
  settingsSearchIndex,
  TSettingsSearchMatches,
  TSettingsSectionId,
} from "@/components/settings/settings-search";
import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type TContext = {
  query: string;
  setQuery: (query: string) => void;
  matches: TSettingsSearchMatches | null;
};

const SettingsSearchContext = createContext<TContext | null>(null);

export function SettingsSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => matchSettings(query), [query]);
  const value = useMemo(() => ({ query, setQuery, matches }), [query, matches]);
  return <SettingsSearchContext value={value}>{children}</SettingsSearchContext>;
}

export function useSettingsSearch() {
  const context = useContext(SettingsSearchContext);
  if (!context) {
    throw new Error("useSettingsSearch must be used within a SettingsSearchProvider");
  }
  return context;
}

// A section shows all of its items when it matched on its own, only the matching
// items otherwise. Sections decide themselves whether anything is left to render.
export function useSettingsSectionSearch(sectionId: TSettingsSectionId) {
  const { matches } = useSettingsSearch();

  return useMemo(() => {
    if (!matches) return { isSectionVisible: true, isItemVisible: () => true };

    const sectionMatches = matches.sections.has(sectionId);
    const section = settingsSearchIndex.find((s) => s.id === sectionId);
    const hasMatchingItem = section?.items.some((item) => matches.items.has(item.id)) ?? false;

    return {
      isSectionVisible: sectionMatches || hasMatchingItem,
      isItemVisible: (itemId: string) => sectionMatches || matches.items.has(itemId),
    };
  }, [matches, sectionId]);
}
