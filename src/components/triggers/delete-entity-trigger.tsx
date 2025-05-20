import ErrorLine from "@/components/error-line";
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
import { defaultAnimationMs } from "@/lib/constants";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { ReactNode, useCallback, useRef, useState } from "react";
import { z } from "zod";

type TProps = {
  dialogTitle: string;
  dialogDescription: string;
  deletingEntityName: string;
  onSubmit: () => Promise<void>;
  onDialogClose?: () => void;
  onDialogCloseImmediate?: () => void;
  error: { message: string } | null;
  disableConfirmationInput?: boolean;
  children: ReactNode;
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
  children,
}: TProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const textToConfirm = `Delete ${deletingEntityName} permanently`;

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
      setIsDialogOpen(false);
      onClose();
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
      open={isDialogOpen}
      onOpenChange={(o) => {
        setIsDialogOpen(o);
        if (!o) onClose();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {dialogDescription}
            {!disableConfirmationInput && (
              <>
                <br />
                <br />
                Type {`"`}
                <span className="text-destructive font-semibold">{textToConfirm}</span>
                {`"`} to confirm.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          data-confirmation-disabled={disableConfirmationInput ? true : undefined}
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="group/form flex flex-col"
        >
          {!disableConfirmationInput && (
            <form.AppField
              name="textToConfirm"
              children={(field) => (
                <field.TextField
                  hideInfo
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
              <DialogClose asChild className="text-muted-foreground">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting, state.values]}
                children={([canSubmit, isSubmitting, values]) => (
                  <form.SubmitButton
                    data-submitting={isSubmitting ? true : undefined}
                    variant="destructive"
                    disabled={
                      !disableConfirmationInput &&
                      (!canSubmit ||
                        (typeof values === "object" && values.textToConfirm !== textToConfirm))
                    }
                    isPending={isSubmitting ? true : false}
                  >
                    Delete
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
