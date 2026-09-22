import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState, type ComponentProps } from "react";

const buttonClass =
  "size-8 rounded-md text-muted-foreground data-active:bg-foreground/3-10 data-active:text-foreground";

export function ThemeSwitch({ className, ...props }: ComponentProps<"div">) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? resolvedTheme : undefined;

  return (
    <div className={cn(className, "flex items-center gap-0.5 p-0 pe-0.5")} {...props}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        forceMinSize="medium"
        aria-label="Light theme"
        data-active={current === "light" || undefined}
        className={buttonClass}
        onClick={() => setTheme("light")}
      >
        <SunIcon className="size-4.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        forceMinSize="medium"
        aria-label="Dark theme"
        data-active={current === "dark" || undefined}
        className={buttonClass}
        onClick={() => setTheme("dark")}
      >
        <MoonIcon className="size-4.5" />
      </Button>
    </div>
  );
}
