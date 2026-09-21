import { cn } from "@/lib/cn";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState, type ComponentProps } from "react";

const buttonClass =
  "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors has-hover:hover:bg-foreground/4-10 has-hover:hover:text-foreground data-active:bg-foreground/3-10 data-active:text-foreground";

export function ThemeSwitch({ className, ...props }: ComponentProps<"div">) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? resolvedTheme : undefined;

  return (
    <div className={cn(className, "flex items-center gap-0.5 p-0 pe-0.5")} {...props}>
      <button
        type="button"
        aria-label="Light theme"
        data-active={current === "light" || undefined}
        className={buttonClass}
        onClick={() => setTheme("light")}
      >
        <SunIcon className="size-4.5" />
      </button>
      <button
        type="button"
        aria-label="Dark theme"
        data-active={current === "dark" || undefined}
        className={buttonClass}
        onClick={() => setTheme("dark")}
      >
        <MoonIcon className="size-4.5" />
      </button>
    </div>
  );
}
