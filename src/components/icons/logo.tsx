import { cn } from "@/components/ui/utils";
import { ComponentProps } from "react";

export default function Logo({ className }: ComponentProps<"svg">) {
  return (
    <svg
      className={cn("size-5 shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 9a12 12 0 0 0 24 0V3h-6v6A6 6 0 0 1 6 9V7H4v2a8 8 0 1 0 16 0V5h2v4A10 10 0 0 1 2 9V5h12v4a2 2 0 1 1-4 0V7H8v2a4 4 0 0 0 8 0V3H0v6Z"
      />
    </svg>
  );
}
