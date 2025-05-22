"use client";

import { availableThemes, TTheme } from "@/components/providers/themes";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useMounted } from "@/lib/hooks/use-mounted";
import { MonitorSmartphoneIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

export default function ThemeButton({
  variant = "default",
}: {
  variant?: "default" | "dropdown-menu-item" | "drawer-item";
}) {
  const { theme, setTheme } = useTheme();
  const toggleTheme = () => {
    const newThemeIndex = (availableThemes.indexOf(theme as TTheme) + 1) % availableThemes.length;
    setTheme(availableThemes[newThemeIndex]);
  };

  const mounted = useMounted();

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

  if (variant === "drawer-item") {
    return (
      <Button
        onClick={(e) => {
          e.preventDefault();
          toggleTheme();
        }}
        variant="ghost"
        className="flex w-full cursor-default items-center justify-start gap-2.5 rounded-lg px-3 py-2.5 text-left leading-tight font-medium"
      >
        <Icon suppressHydrationWarning className="-my-1 -ml-0.5 size-5 shrink-0" />
        <div className="-mt-0.25 flex min-w-0 shrink flex-col">
          <p className="text-muted-foreground text-xs leading-tight font-medium">Theme</p>
          <p suppressHydrationWarning className="min-w-0 shrink leading-tight">
            {themeText}
          </p>
        </div>
      </Button>
    );
  }

  if (variant === "dropdown-menu-item") {
    return (
      <DropdownMenuItem
        onClick={(e) => {
          e.preventDefault();
          toggleTheme();
        }}
        className="flex w-full items-center justify-start text-left leading-tight"
      >
        <Icon suppressHydrationWarning className="-my-1 -ml-0.5 size-5 shrink-0" />
        <div className="-mt-0.25 flex min-w-0 shrink flex-col">
          <p className="text-muted-foreground text-xs leading-tight font-medium">Theme</p>
          <p suppressHydrationWarning className="min-w-0 shrink leading-tight">
            {themeText}
          </p>
        </div>
      </DropdownMenuItem>
    );
  }

  return (
    <Button
      aria-label="Toggle Theme"
      className="rounded-lg p-1.5"
      variant="outline"
      onClick={toggleTheme}
    >
      <Icon suppressHydrationWarning className="size-5" />
    </Button>
  );
}
