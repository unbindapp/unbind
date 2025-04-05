import { cn } from "@/components/ui/utils";
import { ComponentProps } from "react";

export default function AnimatedTimerIcon({
  animate = false,
  className,
  ...rest
}: { animate?: boolean } & ComponentProps<"svg">) {
  return (
    <svg
      {...rest}
      className={cn("size-5 shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="10" x2="14" y1="2" y2="2" />
      <line
        style={{ transformOrigin: "50% 58.33333%" }}
        className={animate ? "animate-spin" : undefined}
        x1="12"
        x2="15"
        y1="14"
        y2="11"
      />
      <circle cx="12" cy="14" r="8" />
    </svg>
  );
}
