import { cn } from "@/components/ui/utils";
import { FC, ReactNode } from "react";

type TProps = {
  children: ReactNode;
  className?: string;
  Icon: FC<React.SVGProps<SVGSVGElement>>;
};

export default function NoItemsCard({ children, className, Icon }: TProps) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex min-h-36 w-full flex-col items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-center",
        className,
      )}
    >
      <Icon className="size-6" />
      {typeof children === "string" ? <p className="w-full leading-tight">{children}</p> : children}
    </div>
  );
}
