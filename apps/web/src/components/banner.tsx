import { cn } from "@/components/ui/utils";
import { HTMLAttributes } from "react";

type TProps = {
  children: React.ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

export default function Banner({ children, className, ...rest }: TProps) {
  return (
    <div
      className={cn(
        "flex w-full items-start justify-start gap-2 rounded-lg border px-3.5 py-2.5 md:max-w-xl",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
