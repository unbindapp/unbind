import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import { availableThemes, TTheme } from "@/components/providers/themes";
import { MonitorSmartphoneIcon, MoonIcon, SlidersHorizontalIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";

type TProps = {
  context: TContextCommandPanelContext;
};

const getThemeText = (theme: string | undefined) => {
  if (theme === "system") return "System";
  if (theme === "light") return "Light";
  return "Dark";
};

export default function usePreferencesItem({ context }: TProps) {
  const mainPageId = "preferences";
  const subpageId = "preferences_subpage";

  const { theme, setTheme } = useTheme();

  const toggleTheme = useCallback(() => {
    const newThemeIndex = (availableThemes.indexOf(theme as TTheme) + 1) % availableThemes.length;
    const newTheme = availableThemes[newThemeIndex];
    setTheme(newTheme);
    return newTheme;
  }, [setTheme, theme]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") setMounted(true);
  }, []);

  const themeText = !mounted ? "Dark" : getThemeText(theme);

  const ThemeIcon = !mounted
    ? MoonIcon
    : theme === "system"
      ? MonitorSmartphoneIcon
      : theme === "light"
        ? SunIcon
        : MoonIcon;

  const item: TCommandPanelItem | null = useMemo(() => {
    if (context.contextType !== "team" && context.contextType !== "project") {
      return null;
    }
    const item: TCommandPanelItem = {
      id: mainPageId,
      title: "Preferences",
      keywords: ["settings", "configuration", "options", "system", "theme"],
      Icon: SlidersHorizontalIcon,
      subpage: {
        id: subpageId,
        title: "Preferences",
        inputPlaceholder: "Search preferences...",
        parentPageId: contextCommandPanelRootPage,
        items: [
          {
            id: "preferences-page_theme",
            title: `Theme: ${themeText}`,
            keywords: ["theme", "dark", "light"],
            onSelect: () => {
              toggleTheme();
            },
            Icon: ThemeIcon,
          },
        ],
      },
    };
    return item;
  }, [context, themeText, ThemeIcon, toggleTheme]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
