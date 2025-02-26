"use client";

import { availableThemes, TTheme } from "@/components/providers/themes";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MonitorSmartphoneIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeButton({
  variant = "default",
}: {
  variant?: "default" | "dropdown-menu-item";
}) {
  const { theme, setTheme } = useTheme();
  const toggleTheme = () => {
    const newThemeIndex =
      (availableThemes.indexOf(theme as TTheme) + 1) % availableThemes.length;
    setTheme(availableThemes[newThemeIndex]);
  };
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setMounted(true);
  }, []);

  const themeText = !mounted
    ? "Dark"
    : theme === "system"
    ? "System"
    : theme === "light"
    ? "Light"
    : "Dark";

  const Icon = !mounted
    ? MoonIcon
    : theme === "system"
    ? MonitorSmartphoneIcon
    : theme === "light"
    ? SunIcon
    : MoonIcon;

  if (variant === "dropdown-menu-item") {
    return (
      <DropdownMenuItem
        onClick={(e) => {
          e.preventDefault();
          toggleTheme();
        }}
        className="w-full flex items-center justify-start gap-2.5 text-left leading-tight"
      >
        <Icon
          suppressHydrationWarning
          className="size-5 shrink-0 -ml-0.5 -my-1"
        />
        <div className="shrink min-w-0 flex flex-col -mt-0.25">
          <p className="text-xs text-muted-foreground font-medium leading-tight">
            Theme
          </p>
          <p suppressHydrationWarning className="shrink min-w-0 leading-tight">
            {themeText}
          </p>
        </div>
      </DropdownMenuItem>
    );
  }

  return (
    <Button
      aria-label="Toggle Theme"
      className="p-1.5 rounded-lg"
      variant="outline"
      onClick={toggleTheme}
    >
      <Icon suppressHydrationWarning className="size-5" />
    </Button>
  );
}
