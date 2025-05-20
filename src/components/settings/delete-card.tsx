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
import { cn } from "@/components/ui/utils";
import { defaultAnimationMs } from "@/lib/constants";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TriangleAlertIcon } from "lucide-react";
import { ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { z } from "zod";

type TDeleteType = "team" | "project" | "service" | "template-draft";

type Props = {
  className?: string;
  deletingEntityName: string | undefined;
  onSubmit: () => Promise<void>;
  onDialogClose: () => void;
  error: { message: string } | null;
  type: TDeleteType;
};

export default function DeleteCard({
  className,
  deletingEntityName,
  onSubmit,
  onDialogClose,
  error,
  type,
}: Props) {
  const paragraph = useMemo(() => getParagraph(type), [type]);
  return (
    <div
      className={cn(
        "bg-destructive/8 text-destructive flex w-full max-w-xl flex-col items-start justify-start gap-4 rounded-xl px-4 py-4",
        className,
      )}
    >
      <div className="-mt-0.75 flex w-full items-center justify-start gap-2 px-1">
        <TriangleAlertIcon className="size-4.5 shrink-0" />
        <p className="min-w-0 shrink leading-snug text-balance">{paragraph}</p>
      </div>
      <DeleteButton
        type={type}
        onSubmit={onSubmit}
        onDialogClose={onDialogClose}
        deletingEntityName={deletingEntityName}
        error={error}
      />
    </div>
  );
}

function DeleteButton({
  type,
  deletingEntityName,
  onSubmit,
  onDialogClose,
  error,
}: {
  type: TDeleteType;
  deletingEntityName?: string;
  onSubmit: () => Promise<void>;
  onDialogClose: () => void;
  error: { message: string } | null;
}) {
  const buttonText = useMemo(() => getButtonText(type), [type]);

  return (
    <DeleteEntityTrigger
      type={type}
      deletingEntityName={deletingEntityName}
      onSubmit={onSubmit}
      onDialogClose={onDialogClose}
      error={error}
    >
      <Button variant="destructive">{buttonText}</Button>
    </DeleteEntityTrigger>
  );
}

export function DeleteEntityTrigger({
  type,
  deletingEntityName,
  onSubmit,
  onDialogClose,
  onDialogCloseImmediate,
  error,
  description: descriptionProp,
  disableConfirmationInput,
  children,
}: {
  type: TDeleteType;
  deletingEntityName?: string;
  onSubmit: () => Promise<void>;
  onDialogClose: () => void;
  onDialogCloseImmediate?: () => void;
  error: { message: string } | null;
  description?: string;
  disableConfirmationInput?: boolean;
  children: ReactNode;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const textToConfirm = deletingEntityName
    ? `Delete ${deletingEntityName} permanently`
    : "Delete this project permanently";

  const title = useMemo(() => getDialogTitle(type), [type]);
  const description = useMemo(
    () => (descriptionProp ? descriptionProp : getDialogDescription(type)),
    [type, descriptionProp],
  );

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
      onDialogClose();
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
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

function getDialogTitle(type: TDeleteType) {
  if (type === "service") return "Delete Service";
  if (type === "project") return "Delete Project";
  if (type === "template-draft") return "Delete Template";
  return "Delete Team";
}

function getButtonText(type: TDeleteType) {
  if (type === "service") return "Delete Service";
  if (type === "project") return "Delete Project";
  if (type === "template-draft") return "Delete Template";
  return "Delete Team";
}

function getDialogDescription(type: TDeleteType) {
  if (type === "service") {
    return "Are you sure you want to delete this service? This action cannot be undone.";
  }
  if (type === "project") {
    return "Are you sure you want to delete this project? This action cannot be undone. All environments, services, and data inside this project will be permanently deleted.";
  }
  if (type === "template-draft") {
    return "Are you sure you want to delete this template? This action cannot be undone.";
  }
  return "Are you sure you want to delete this team? This action cannot be undone. All the projects, environments, services, and data inside this team will be permanently deleted.";
}

function getParagraph(type: TDeleteType) {
  if (type === "service") {
    return "This action cannot be undone. All data inside the service will be permanently deleted.";
  }
  if (type === "project") {
    return "This action cannot be undone. All environments, services, and data inside this project will be permanently deleted.";
  }
  if (type === "template-draft") {
    return "This action cannot be undone. All data inside the template will be permanently deleted.";
  }
  return "This action cannot be undone. All the projects, environments, services, and data inside this team will be permanently deleted.";
}
