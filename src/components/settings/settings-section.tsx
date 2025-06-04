import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/components/ui/utils";
import { CheckIcon, RotateCcwIcon } from "lucide-react";
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
  onClickResetChanges,
  ...rest
}: {
  title: string;
  Icon: FC<{ className?: string }>;
  children: ReactNode;
  classNameTitleDiv?: string;
  classNameHeader?: string;
  classNameContent?: string;
  changeCount?: number;
  onClickResetChanges?: () => void;
} & TWrapperProps) {
  return (
    <Wrapper
      data-changed={changeCount !== undefined && changeCount > 0 ? true : undefined}
      className={cn("group/wrapper data-changed:border-process/20", className)}
      {...rest}
    >
      <div
        className={cn(
          "text-muted-foreground group-data-changed/wrapper:text-process bg-background-hover group-data-changed/wrapper:border-process/15 group-data-changed/wrapper:bg-process/8 flex w-full items-start justify-between gap-4 border-b px-3.5 sm:px-4",
          classNameHeader,
        )}
      >
        <div className="flex min-w-0 shrink items-center gap-2.5 py-3">
          <Icon className="size-5 shrink-0" />
          <h3 className={cn("min-w-0 shrink text-lg leading-tight font-medium", classNameTitleDiv)}>
            {title}
          </h3>
        </div>
        {changeCount !== undefined && changeCount > 0 && (
          <div className="-mr-2.25 flex shrink-0 items-center justify-end gap-1.5 py-1.25 sm:-mr-2.75">
            <ResetTrigger changeCount={changeCount} onClickResetChanges={onClickResetChanges}>
              <Button
                type="button"
                className="text-foreground has-hover:hover:text-foreground active:text-foreground"
                aria-label="Reset changes"
                variant="outline-process"
                size="icon"
              >
                <RotateCcwIcon className="size-5 scale-90" />
              </Button>
            </ResetTrigger>
            <div className="relative">
              <Button aria-label="Apply changes" variant="outline-process" size="icon">
                <CheckIcon className="size-5" />
              </Button>
              <p className="bg-process text-background pointer-events-none absolute -top-0.5 -left-0.5 flex items-center justify-center rounded-sm px-0.75 py-0.25 font-mono text-xs leading-none font-bold">
                {changeCount}
              </p>
            </div>
          </div>
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
      {changeCount !== undefined && changeCount > 0 && (
        <div className="border-process/20 flex w-full border-t px-2 py-2.25 sm:px-3 sm:py-3.25">
          <div className="w-1/2 p-1">
            <ResetTrigger changeCount={changeCount} onClickResetChanges={onClickResetChanges}>
              <Button className="w-full" type="button" aria-label="Reset changes" variant="outline">
                <RotateCcwIcon className="size-5 scale-90" />
                <p className="min-w-0 shrink truncate">Revert</p>
              </Button>
            </ResetTrigger>
          </div>
          <div className="w-1/2 p-1">
            <Button className="w-full" variant="process">
              <CheckIcon className="size-5" />
              <p className="min-w-0 shrink truncate">Apply ({changeCount})</p>
            </Button>
          </div>
        </div>
      )}
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

function ResetTrigger({
  changeCount,
  onClickResetChanges,
  children,
}: {
  changeCount: number;
  onClickResetChanges?: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent hideXButton className="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle className="text-warning">Revert Changes: {changeCount}</DialogTitle>
          <DialogDescription>Are you sure you want to revert the changes?</DialogDescription>
        </DialogHeader>
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <DialogClose asChild className="text-muted-foreground">
            <Button type="button" variant="ghost-warning">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="warning" onClick={onClickResetChanges}>
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
