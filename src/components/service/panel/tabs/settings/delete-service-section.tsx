import ErrorLine from "@/components/error-line";
import { useServicesUtils } from "@/components/project/services-provider";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import { useService } from "@/components/service/service-provider";
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
import { api } from "@/server/trpc/setup/client";
import { TriangleAlertIcon } from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";

type TProps = {
  className?: string;
};

export default function DeleteServiceSection({ className }: TProps) {
  return (
    <div
      className={cn(
        "bg-destructive/8 text-destructive flex w-full max-w-xl flex-col items-start justify-start gap-4 rounded-xl px-4 py-4",
        className,
      )}
    >
      <div className="-mt-0.75 flex w-full items-center justify-start gap-2 px-1">
        <TriangleAlertIcon className="size-4.5 shrink-0" />
        <p className="min-w-0 shrink leading-snug text-balance">
          Proceed with caution! This action cannot be undone.
        </p>
      </div>
      <DeleteButton />
    </div>
  );
}

function DeleteButton() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const textToConfirm = "Delete this service permanently";
  const { teamId, projectId, environmentId, serviceId } = useService();
  const { invalidate: invalidateServices } = useServicesUtils({
    teamId,
    projectId,
    environmentId,
  });
  const { closePanel } = useServicePanel();

  const {
    mutateAsync: deleteService,
    error,
    reset,
  } = api.services.delete.useMutation({
    onSuccess: async () => {
      invalidateServices();
      closePanel();
    },
  });

  const form = useAppForm({
    defaultValues: {
      textToConfirm: "",
    },
    validators: {
      onChange: z
        .object({
          textToConfirm: z.string().refine((v) => v === textToConfirm, {
            message: "Please type the correct text to confirm",
          }),
        })
        .strip(),
    },
    onSubmit: async ({ formApi }) => {
      await deleteService({ teamId, projectId, environmentId, serviceId });
      formApi.reset();
    },
  });

  const timeout = useRef<NodeJS.Timeout>(undefined);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(o) => {
        setIsDialogOpen(o);
        if (!o) {
          if (timeout.current) clearTimeout(timeout.current);
          timeout.current = setTimeout(() => {
            form.reset();
            reset();
          }, defaultAnimationMs);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">Delete Service</Button>
      </DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>Delete Service</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this services? This action cannot be undone.
            <br />
            <br />
            Type {`"`}
            <span className="text-destructive font-semibold">{textToConfirm}</span>
            {`"`} to confirm.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="mt-2 flex flex-col"
        >
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
          {error && <ErrorLine message={error?.message} className="mt-4" />}
          <div className="mt-4 flex w-full flex-wrap items-center justify-end gap-2">
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
                    !canSubmit ||
                    (typeof values === "object" && values.textToConfirm !== textToConfirm)
                  }
                  isPending={isSubmitting ? true : false}
                >
                  Delete
                </form.SubmitButton>
              )}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
