import { cn } from "@/components/ui/utils";
import { FC, ReactNode } from "react";

type TProps = {
  children: ReactNode;
  className?: string;
  Icon: FC<React.SVGProps<SVGSVGElement>>;
  asElement?: "div" | "li";
};

export default function NoItemsCard({ children, className, Icon, asElement = "div" }: TProps) {
  const Element = asElement === "li" ? "li" : "div";

  return (
    <Element
      className={cn(
        "text-muted-foreground flex min-h-38 w-full flex-col items-center justify-center gap-2 rounded-xl border px-4 pt-6 pb-7 text-center",
        className,
      )}
    >
      <Icon className="size-6" />
      {typeof children === "string" ? <p className="w-full leading-tight">{children}</p> : children}
    </Element>
  );
}
