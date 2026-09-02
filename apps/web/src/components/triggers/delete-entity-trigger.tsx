import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import {
  createDialogHandle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  TDialogHandle,
} from "@/components/ui/dialog";
import { defaultAnimationMs } from "@/lib/constants";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { ReactElement, FC, ReactNode, useCallback, useRef, useState } from "react";
import { z } from "zod";

type TProps = {
  dialogTitle: string;
  dialogDescription: ReactNode;
  deletingEntityName: string;
  onSubmit: () => Promise<void>;
  onDialogClose?: () => void;
  onDialogCloseImmediate?: () => void;
  error: { message: string } | null;
  disableConfirmationInput?: boolean;
  submitButtonText?: string;
  variant?: "destructive" | "warning";
  EntityNameBadge?: FC<{ className?: string }>;
  handle?: TDialogHandle;
  children?: ReactElement;
  textToConfirm?: string;
};

export function DeleteEntityTrigger({
  dialogTitle,
  dialogDescription,
  deletingEntityName,
  onSubmit,
  onDialogClose,
  onDialogCloseImmediate,
  error,
  disableConfirmationInput,
  submitButtonText,
  variant = "destructive",
  EntityNameBadge,
  handle,
  textToConfirm: textToConfirmProp,
  children,
}: TProps) {
  const [internalHandle] = useState(() => createDialogHandle());
  const dialogHandle = handle ?? internalHandle;

  const textToConfirm = textToConfirmProp || `Delete ${deletingEntityName} permanently`;

  const form = useAppForm({
    defaultValues: disableConfirmationInput
      ? undefined
      : {
          textToConfirm: "",
        },
    validators: {
      onChange: disableConfirmationInput
        ? undefined
        : z
            .object({
              textToConfirm: z.string().refine((v) => v === textToConfirm, {
                message: "Please type the correct text to confirm",
              }),
            })
            .strip(),
    },
    onSubmit: async ({ formApi }) => {
      await onSubmit();
      dialogHandle.close();
      formApi.reset();
    },
  });

  const timeout = useRef<NodeJS.Timeout>(undefined);

  const onClose = useCallback(() => {
    if (onDialogCloseImmediate) {
      onDialogCloseImmediate();
    }
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      form.reset();
      onDialogClose?.();
    }, defaultAnimationMs);
  }, [onDialogCloseImmediate, onDialogClose, form]);

  return (
    <Dialog
      handle={dialogHandle}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      {children && <DialogTrigger render={children} />}
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle className={variant === "warning" ? "text-warning" : "text-destructive"}>
            {dialogTitle}
          </DialogTitle>
          {EntityNameBadge && <EntityNameBadge />}
          <DialogDescription>
            {dialogDescription}
            {!disableConfirmationInput && (
              <>
                <br />
                <br />
                Type {`"`}
                <span
                  className={
                    variant === "warning"
                      ? "text-warning font-semibold"
                      : "text-destructive font-semibold"
                  }
                >
                  {textToConfirm}
                </span>
                {`"`} to confirm.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          data-confirmation-disabled={disableConfirmationInput || undefined}
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit(e);
          }}
          className="group/form flex flex-col"
        >
          {!disableConfirmationInput && (
            <form.AppField
              name="textToConfirm"
              children={(field) => (
                <field.TextField
                  hideError
                  field={field}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full"
                  placeholder={textToConfirm}
                />
              )}
            />
          )}
          <div className="mt-4 flex w-full flex-col gap-4 group-data-confirmation-disabled/form:mt-0">
            {error && <ErrorLine message={error?.message} />}
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <DialogClose
                className="text-muted-foreground"
                render={
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                }
              />
              <form.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                  values: state.values,
                })}
                children={({ canSubmit, isSubmitting, values }) => (
                  <form.SubmitButton
                    data-submitting={isSubmitting || undefined}
                    variant={variant}
                    disabled={
                      !disableConfirmationInput &&
                      (!canSubmit ||
                        (typeof values === "object" && values.textToConfirm !== textToConfirm))
                    }
                    isPending={isSubmitting ? true : false}
                  >
                    {submitButtonText || "Delete"}
                  </form.SubmitButton>
                )}
              />
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
