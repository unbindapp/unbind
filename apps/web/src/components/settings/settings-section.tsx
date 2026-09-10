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
import { LoaderIcon, Undo2Icon } from "lucide-react";
import { ReactElement, FC, HTMLAttributes, ReactNode, RefObject, useRef } from "react";

type TProps = {
  title: string;
  Icon: FC<{ className?: string }>;
  children: ReactNode;
  classNameTitleDiv?: string;
  classNameHeader?: string;
  classNameContent?: string;
  changeCount?: number;
  // Tints the section without the apply footer, for sections that stage their edits
  hasChanges?: boolean;
  // Locks the section while its staged edits are being deployed
  isApplying?: boolean;
  // Discards the section's staged edits, from a "Discard" button on the title row
  onDiscard?: () => void;
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
  hasChanges,
  isApplying,
  onDiscard,
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
  const isChanged = hasChanges ?? (changeCount !== undefined && changeCount > 0);
  // A confirmed reset unmounts the button that opened the dialog, so focus lands here instead
  const headerRef = useRef<HTMLDivElement>(null);

  return (
    <Wrapper
      data-staged={isChanged || undefined}
      data-applying={isApplying || undefined}
      className={cn(
        "group/wrapper data-staged:border-change/5-10 scroll-mt-4 data-applying:pointer-events-none",
        className,
      )}
      {...rest}
    >
      <div
        ref={headerRef}
        tabIndex={-1}
        className={cn(
          "text-muted-foreground group-data-staged/wrapper:text-change bg-card group-data-staged/wrapper:border-change/5-10 group-data-staged/wrapper:bg-change/2-10 relative flex w-full items-start gap-4 border-b px-3.5 outline-none sm:px-4",
          classNameHeader,
        )}
      >
        {entityId && <NewEntityIndicator id={entityId} />}
        <div className="flex min-w-0 shrink items-center gap-2.5 py-3">
          <Icon className="size-5 shrink-0" />
          <h3
            className={cn(
              "min-w-0 flex-1 text-lg leading-tight font-medium wrap-break-word",
              classNameTitleDiv,
            )}
          >
            {title}
          </h3>
          {isApplying && <LoaderIcon className="my-auto size-4.5 shrink-0 animate-spin" />}
        </div>
        {!isApplying && isChanged && onDiscard && (
          <ResetTrigger onClickResetChanges={onDiscard} finalFocusRef={headerRef}>
            <Button
              type="button"
              variant="outline-change"
              size="sm"
              className="my-auto -mr-2.5 ml-auto min-w-0 shrink gap-1.5 px-2.5 py-1.5"
            >
              <Undo2Icon className="-ml-0.5 size-4.5" />
              <span className="min-w-0 shrink wrap-break-word">Discard</span>
            </Button>
          </ResetTrigger>
        )}
      </div>
      <div
        className={cn(
          "group-data-applying/wrapper:animate-skeleton-smooth-weaker flex w-full flex-col gap-6 px-3 pt-3 pb-3.25 transition-opacity duration-(--skeleton-smooth-lead-in) group-data-applying/wrapper:opacity-(--skeleton-smooth-weaker-opacity) sm:px-4.5 sm:pt-3.75 sm:pb-4.75",
          classNameContent,
        )}
      >
        {children}
      </div>
      {changeCount !== undefined && changeCount > 0 && (
        <div className="border-change/5-10 bg-change/2-10 flex w-full flex-col border-t p-1.5">
          {error && (
            <div className="w-full p-1.5">
              <ErrorLine message={error} className="border-destructive/6-10 border" />
            </div>
          )}
          <div className="flex w-full">
            <div className="w-1/2 p-1.5">
              <ResetTrigger
                changeCount={changeCount}
                onClickResetChanges={onClickResetChanges}
                finalFocusRef={headerRef}
              >
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
  finalFocusRef,
  children,
}: {
  changeCount?: number;
  onClickResetChanges?: () => void;
  finalFocusRef: RefObject<HTMLElement | null>;
  children: ReactElement;
}) {
  const isConfirmedRef = useRef(false);
  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) isConfirmedRef.current = false;
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent
        hideXButton
        className="w-lg max-w-full"
        finalFocus={() => (isConfirmedRef.current ? finalFocusRef.current : true)}
      >
        <DialogHeader>
          <DialogTitle>
            {changeCount === undefined ? "Discard Changes" : `Discard Changes: ${changeCount}`}
          </DialogTitle>
          <DialogDescription>Are you sure you want to discard the changes?</DialogDescription>
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
          <DialogClose
            render={
              <Button
                onClick={() => {
                  isConfirmedRef.current = true;
                  onClickResetChanges?.();
                }}
              >
                Confirm
              </Button>
            }
          />
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
