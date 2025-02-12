import { cn } from "@/components/ui/utils";
import { ComponentProps } from "react";

export default function SlashIcon({
  className,
  ...rest
}: ComponentProps<"svg">) {
  return (
    <svg
      className={cn("size-5 shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      {...rest}
    >
      <path stroke="currentColor" strokeLinecap="round" d="m9 22 6-20" />
    </svg>
  );
}
