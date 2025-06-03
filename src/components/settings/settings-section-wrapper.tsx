import { cn } from "@/components/ui/utils";
import { HTMLAttributes, ReactNode } from "react";

export default function SettingsSectionWrapper(
  props: {
    children: ReactNode;
  } & (
    | ({ asElement?: never } & HTMLAttributes<HTMLDivElement>)
    | ({ asElement: "form" } & HTMLAttributes<HTMLFormElement>)
  ),
) {
  if (props.asElement === "form") {
    const { children, asElement: Element, className, ...rest } = props;
    return (
      <Element className={cn("flex w-full flex-col gap-6", className)} {...rest}>
        {children}
      </Element>
    );
  }

  const { children, asElement: Element = "div", className, ...rest } = props;
  return (
    <Element className={cn("flex w-full flex-col gap-6", className)} {...rest}>
      {children}
    </Element>
  );
}
