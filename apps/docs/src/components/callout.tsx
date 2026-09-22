import { cn } from "@/lib/cn";
import { CircleAlert, CircleCheck, Info, Lightbulb, TriangleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

type TCalloutType = "info" | "tip" | "warn" | "warning" | "error" | "success" | "idea";
type TTone = "process" | "warning" | "destructive" | "success" | "wait";

const tones: Record<TCalloutType, TTone> = {
  info: "process",
  tip: "process",
  warn: "warning",
  warning: "warning",
  error: "destructive",
  success: "success",
  idea: "wait",
};

const toneClasses: Record<TTone, string> = {
  process: "bg-process/3-10 border-process/3-10 text-process",
  warning: "bg-warning/3-10 border-warning/3-10 text-warning",
  destructive: "bg-destructive/3-10 border-destructive/3-10 text-destructive",
  success: "bg-success/3-10 border-success/3-10 text-success",
  wait: "bg-wait/3-10 border-wait/3-10 text-wait",
};

const icons: Record<TTone, ReactNode> = {
  process: <Info />,
  warning: <CircleAlert />,
  destructive: <TriangleAlert />,
  success: <CircleCheck />,
  wait: <Lightbulb />,
};

// Fumadocs' Callout with the app's banner look: no bar, tinted surface, outline icon.
export function Callout({
  type = "info",
  title,
  icon,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "title"> & {
  type?: TCalloutType;
  title?: ReactNode;
  icon?: ReactNode;
}) {
  const tone = tones[type] ?? "process";
  return (
    <div
      className={cn(
        "my-4 flex gap-2 rounded-xl border px-3 pt-2.5 pb-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {icon ?? icons[tone]}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {title && <p className="my-0! font-medium">{title}</p>}
        <div className="text-muted-foreground prose-no-margin empty:hidden">{children}</div>
      </div>
    </div>
  );
}
