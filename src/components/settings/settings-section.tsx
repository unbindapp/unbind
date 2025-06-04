import { cn } from "@/components/ui/utils";
import { FC, HTMLAttributes, ReactNode } from "react";

export function SettingsSection({
  title,
  Icon,
  children,
  classNameTitleDiv,
  classNameHeader,
  classNameContent,
  changeCount,
  className,
  ...rest
}: {
  title: string;
  Icon: FC<{ className?: string }>;
  children: ReactNode;
  classNameTitleDiv?: string;
  classNameHeader?: string;
  classNameContent?: string;
  changeCount?: number;
} & TWrapperProps) {
  return (
    <Wrapper
      data-changed={changeCount !== undefined && changeCount > 0 ? true : undefined}
      className={cn("group/wrapper data-changed:border-process/20", className)}
      {...rest}
    >
      <div
        className={cn(
          "text-muted-foreground group-data-changed/wrapper:text-process bg-background-hover group-data-changed/wrapper:border-process/15 group-data-changed/wrapper:bg-process/8 flex w-full items-start justify-between gap-4 border-b px-3.5 py-2.5 sm:px-4 sm:py-3",
          classNameHeader,
        )}
      >
        <div className="flex min-w-0 shrink items-center gap-2.5">
          <Icon className="size-5 shrink-0" />
          <h3 className={cn("min-w-0 shrink text-lg leading-tight font-medium", classNameTitleDiv)}>
            {title}
          </h3>
        </div>
        {changeCount !== undefined && changeCount > 0 && (
          <p className="bg-process text-background -mr-1.5 max-w-28 shrink-0 truncate rounded-full px-2 py-[0.15625rem] text-sm leading-tight font-semibold">
            {changeCount} change{changeCount > 1 ? "s" : ""}
          </p>
        )}
      </div>
      <div
        className={cn(
          "flex w-full flex-col gap-6 px-3 pt-3 pb-3.25 sm:px-4.5 sm:pt-3.75 sm:pb-4.75",
          classNameContent,
        )}
      >
        {children}
      </div>
    </Wrapper>
  );
}

type TWrapperProps =
  | ({
      asElement?: "div";
    } & HTMLAttributes<HTMLDivElement>)
  | ({
      asElement: "form";
    } & HTMLAttributes<HTMLFormElement>);

function Wrapper(props: TWrapperProps) {
  if (props.asElement === "form") {
    const { asElement: Element = "form", className, children, ...rest } = props;
    return (
      <Element
        className={cn(
          "relative z-0 flex w-full flex-col overflow-hidden rounded-xl border md:max-w-xl",
          className,
        )}
        {...rest}
      >
        {children}
      </Element>
    );
  }

  const { asElement: Element = "div", className, children, ...rest } = props;
  return (
    <Element
      className={cn(
        "relative z-0 flex w-full flex-col overflow-hidden rounded-xl border md:max-w-xl",
        className,
      )}
      {...rest}
    >
      {children}
    </Element>
  );
}
