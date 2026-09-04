import ErrorLine from "@/components/error-line";
import { NewEntityIndicator } from "@/components/new-entity-indicator";
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
import { ReactElement, FC, HTMLAttributes, ReactNode } from "react";

type TProps = {
  title: string;
  Icon: FC<{ className?: string }>;
  children: ReactNode;
  classNameTitleDiv?: string;
  classNameHeader?: string;
  classNameContent?: string;
  changeCount?: number;
  SubmitTrigger?: FC<{ children: ReactElement }>;
  onClickResetChanges?: () => void;
} & TWrapperProps &
  TSubmitButtonProps;

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
  SubmitButton,
  SubmitTrigger,
  isPending,
  error,
  entityId,
  ...rest
}: TProps) {
  const SubmitButtonElement = SubmitButton || Button;
  const SubmitTriggerElement =
    SubmitTrigger || (({ children }: { children: ReactElement }) => children);

  return (
    <Wrapper
      data-changed={(changeCount !== undefined && changeCount > 0) || undefined}
      className={cn("group/wrapper data-changed:border-change/25 scroll-mt-4", className)}
      {...rest}
    >
      <div
        className={cn(
          "text-muted-foreground group-data-changed/wrapper:text-change bg-card group-data-changed/wrapper:border-change/20 group-data-changed/wrapper:bg-change/8 relative flex w-full items-start justify-between gap-4 border-b px-3.5 sm:px-4",
          classNameHeader,
        )}
      >
        {entityId && <NewEntityIndicator id={entityId} />}
        <div className="flex min-w-0 shrink items-center gap-2.5 py-3">
          <Icon className="size-5 shrink-0" />
          <h3 className={cn("min-w-0 shrink text-lg leading-tight font-medium", classNameTitleDiv)}>
            {title}
          </h3>
        </div>
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
        <div className="border-change/20 bg-change/8 flex w-full flex-col border-t p-1.5">
          {error && (
            <div className="w-full p-1.5">
              <ErrorLine message={error} className="border-destructive/20 border" />
            </div>
          )}
          <div className="flex w-full">
            <div className="w-1/2 p-1.5">
              <ResetTrigger changeCount={changeCount} onClickResetChanges={onClickResetChanges}>
                <Button
                  className="text-foreground has-hover:hover:text-foreground active:text-foreground w-full"
                  type="button"
                  aria-label="Reset changes"
                  variant="outline-change"
                >
                  Cancel
                </Button>
              </ResetTrigger>
            </div>
            <div className="w-1/2 p-1.5">
              <SubmitTriggerElement>
                <SubmitButtonElement isPending={isPending} className="w-full" variant="change">
                  Apply ({changeCount})
                </SubmitButtonElement>
              </SubmitTriggerElement>
            </div>
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
  children: ReactElement;
}) {
  return (
    <Dialog>
      <DialogTrigger render={children} />
      <DialogContent hideXButton className="w-lg max-w-full">
        <DialogHeader>
          <DialogTitle>Revert Changes: {changeCount}</DialogTitle>
          <DialogDescription>Are you sure you want to revert the changes?</DialogDescription>
        </DialogHeader>
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <DialogClose
            className="text-muted-foreground"
            render={
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            }
          />
          <Button onClick={onClickResetChanges}>Confirm</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type TSubmitButtonProps =
  | {
      SubmitButton: FC<{ className?: string; children?: ReactNode }>;
      error: string | undefined;
      isPending: boolean;
      entityId: string;
    }
  | {
      SubmitButton?: never;
      error?: never;
      isPending?: never;
      entityId: string;
    };
