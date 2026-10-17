import { cn } from "@/components/ui/utils";
import { cva, VariantProps } from "class-variance-authority";
import { FC, ReactNode } from "react";

type TProps = {
  children: ReactNode;
  className?: string;
  Icon: FC<React.SVGProps<SVGSVGElement>>;
  asElement?: "div" | "li";
} & TNoItemsCardVariants;

export type TNoItemsCardVariants = VariantProps<typeof noItemsCardVariants>;

const noItemsCardVariants = cva(
  "text-muted-foreground flex w-full flex-col items-center justify-center gap-2 rounded-xl border px-4 pt-6 pb-7 text-center",
  {
    variants: {
      cardHeight: {
        md: "min-h-38",
        lg: "min-h-44",
      },
    },
    defaultVariants: {
      cardHeight: "md",
    },
  },
);

export default function NoItemsCard({
  children,
  className,
  Icon,
  asElement = "div",
  cardHeight,
}: TProps) {
  const Element = asElement === "li" ? "li" : "div";

  return (
    <Element className={cn(noItemsCardVariants({ cardHeight, className }))}>
      <Icon className="size-6" />
      {typeof children === "string" ? <p className="w-full leading-tight">{children}</p> : children}
    </Element>
  );
}
