"use client";

import ErrorLine from "@/components/error-line";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useAsyncPush } from "@/components/providers/async-push-provider";
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
import { useAppForm } from "@/lib/hooks/use-app-form";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { api } from "@/server/trpc/setup/client";
import { TriangleAlertIcon } from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";

type Props = {
  className?: string;
};

export default function DeleteProjectSection({ className }: Props) {
  const { teamId, projectId } = useIdsFromPathname();
  return (
    <div
      className={cn(
        "bg-destructive/8 text-destructive flex w-full max-w-xl flex-col items-start justify-start gap-4 rounded-xl px-4 py-4",
        className,
      )}
    >
      <div className="-mt-0.75 flex w-full items-start justify-start gap-2.5 px-1">
        <TriangleAlertIcon className="mt-1 size-5 shrink-0" />
        <p className="min-w-0 shrink leading-snug text-balance">
          Proceed with caution! Deleting this project will delete all environments and services
          inside it. This action cannot be undone.
        </p>
      </div>
      {teamId && projectId && <DeleteButton teamId={teamId} projectId={projectId} />}
    </div>
  );
}

function DeleteButton({ teamId, projectId }: { teamId: string; projectId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const textToConfirm = "Delete this project permanently";
  const { asyncPush } = useAsyncPush();
  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId });

  const {
    mutateAsync: deleteProject,
    error,
    reset,
  } = api.projects.delete.useMutation({
    onSuccess: async () => {
      invalidateProjects();
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
      await deleteProject({ teamId, projectId });
      await asyncPush(`/${teamId}`);
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
          }, 200);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">Delete Project</Button>
      </DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this project? This action cannot be undone. All the
            services and data inside this project will be permanently deleted.
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
                <div className="flex w-full flex-row gap-3 lg:w-auto">
                  <form.SubmitButton
                    data-submitting={isSubmitting ? true : undefined}
                    variant="destructive"
                    className="group/button flex-1"
                    disabled={
                      !canSubmit ||
                      (typeof values === "object" && values.textToConfirm !== textToConfirm)
                    }
                    isPending={isSubmitting ? true : false}
                  >
                    Delete
                  </form.SubmitButton>
                </div>
              )}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
