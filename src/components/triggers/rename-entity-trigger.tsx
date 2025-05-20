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
import {
  serviceDescriptionMaxLength,
  serviceNameMaxLength,
} from "@/server/trpc/api/services/types";
import { ReactNode, useCallback, useRef, useState } from "react";
import { z } from "zod";

type TPropsShared = {
  onDialogClose?: () => void;
  onDialogCloseImmediate?: () => void;
  error: { message: string } | null;
  children: ReactNode;
  dialogTitle: string;
  dialogDescription: string;
  formSchema: z.ZodSchema<{ name: string; description: string }>;
  onSubmit: (props: { name: string; description: string }) => Promise<void>;
};

type TPropsNameAndDescription = {
  type: "name-and-description";
  name: string;
  description: string;
  nameInputTitle: string;
  descriptionInputTitle: string;
};

type TPropsNameOnly = {
  type: "name-only";
  name: string;
  nameInputTitle: string;
  description?: never;
  descriptionInputTitle?: never;
};

type TProps = TPropsShared & (TPropsNameAndDescription | TPropsNameOnly);

export default function RenameEntityTrigger({
  type,
  name,
  description,
  nameInputTitle,
  descriptionInputTitle,
  dialogTitle,
  dialogDescription,
  formSchema,
  onSubmit,
  onDialogClose,
  onDialogCloseImmediate,
  error,
  children,
}: TProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const timeout = useRef<NodeJS.Timeout>(undefined);

  const form = useAppForm({
    defaultValues: { name, description: description || "" },
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      if (value.name === name && (type === "name-only" || value.description === description)) {
        setIsDialogOpen(false);
        onClose();
        return;
      }
      await onSubmit(value);
      setIsDialogOpen(false);
      onClose();
    },
  });

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
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="flex w-full flex-col gap-4"
        >
          <div className="flex w-full flex-col gap-2">
            <form.AppField
              name="name"
              children={(field) => (
                <field.TextField
                  field={field}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full"
                  placeholder={name}
                  layout="label-included"
                  inputTitle={nameInputTitle}
                  maxLength={serviceNameMaxLength}
                />
              )}
            />
            {type === "name-and-description" && (
              <form.AppField
                name="description"
                children={(field) => (
                  <field.TextField
                    field={field}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full"
                    placeholder={description}
                    layout="label-included"
                    inputTitle={descriptionInputTitle}
                    maxLength={serviceDescriptionMaxLength}
                  />
                )}
              />
            )}
          </div>
          <div className="flex w-full flex-col gap-4">
            {error && <ErrorLine message={error.message} />}
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <DialogClose asChild className="text-muted-foreground">
                <Button type="button" variant="ghost">
                  Close
                </Button>
              </DialogClose>
              <form.Subscribe
                selector={(state) => [state.isSubmitting]}
                children={([isSubmitting]) => (
                  <form.SubmitButton isPending={isSubmitting ? true : false}>
                    Save
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
