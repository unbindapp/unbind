"use client";

import { useEnvironmentsUtils } from "@/components/environment/environments-provider";
import ErrorLine from "@/components/error-line";
import { useProject, useProjectUtils } from "@/components/project/project-provider";
import { useProjectsUtils } from "@/components/project/projects-provider";
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
  createEnvironment as createEnvironmentFn,
  environmentNameMaxLength,
  EnvironmentNameSchema,
  type TEnvironmentShallow,
} from "@/lib/queries/environments";
import { useMutation } from "@tanstack/react-query";
import { ResultAsync } from "neverthrow";
import {
  ButtonHTMLAttributes,
  cloneElement,
  isValidElement,
  ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { z } from "zod";

export type TCreateEnvironmentDialogProps = {
  children: ReactNode;
  onFormSubmitSuccessful?: () => void;
  asyncOnFormSubmitSuccessful?: (args: {
    environment: TEnvironmentShallow;
  }) => ResultAsync<unknown, Error>;
  dialogOnOpenChange?: (open: boolean) => void;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function CreateEnvironmentDialog({
  children,
  onFormSubmitSuccessful,
  asyncOnFormSubmitSuccessful,
  dialogOnOpenChange,
  ...rest
}: TCreateEnvironmentDialogProps) {
  const { teamId, projectId } = useProject();
  const {
    mutateAsync: createEnvironment,
    error: createEnvironmentError,
    reset: createEnvironmentReset,
  } = useMutation({ mutationFn: createEnvironmentFn });
  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId });
  const { invalidate: invalidateProject } = useProjectUtils({ teamId, projectId });
  const { invalidate: invalidateEnvironments } = useEnvironmentsUtils({ teamId, projectId });

  const [open, setOpen] = useState(false);

  const form = useAppForm({
    defaultValues: {
      name: "",
    },
    validators: {
      onChange: z
        .object({
          name: EnvironmentNameSchema,
        })
        .strip(),
    },
    onSubmit: async ({ formApi, value }) => {
      const res = await createEnvironment({
        name: value.name,
        description: "",
        teamId,
        projectId,
      });

      // The project route guard validates the `environment` search param against
      // the project query's cached environments and redirects to a fallback when
      // it isn't found. Await the refetches (especially the project query) before
      // navigating so the freshly created environment is present and the
      // navigation actually sticks instead of bouncing to the default one.
      const invalidateRes = await ResultAsync.fromPromise(
        Promise.all([invalidateProject(), invalidateProjects(), invalidateEnvironments()]),
        () => new Error("Invalidation failed, reload the page to see the new environment"),
      );
      if (invalidateRes.isErr()) {
        toast.error("Failed to refresh data", {
          description: invalidateRes.error.message,
        });
        return;
      }

      setOpen(false);
      onFormSubmitSuccessful?.();

      if (asyncOnFormSubmitSuccessful) {
        const result = await asyncOnFormSubmitSuccessful({ environment: res.data });
        if (result.isErr()) {
          toast.error("Something went wrong", {
            description: result.error.message,
          });
          return;
        }
      }

      formApi.reset();
    },
  });

  const childrenWithRestProps = useMemo(
    () => (isValidElement(children) ? cloneElement(children, { ...rest }) : children),
    [children, rest],
  );

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            form.reset();
            createEnvironmentReset();
          }, defaultAnimationMs);
        }
        dialogOnOpenChange?.(o);
      }}
    >
      <DialogTrigger asChild>{childrenWithRestProps}</DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>Create Environment</DialogTitle>
          <DialogDescription>Give a name to the new environment.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit(e);
          }}
          className="flex flex-col"
        >
          <form.AppField
            name="name"
            children={(field) => (
              <field.TextField
                autoCapitalize="none"
                dontCheckUntilSubmit
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full"
                placeholder="development"
                maxLength={environmentNameMaxLength}
              />
            )}
          />
          {createEnvironmentError && (
            <ErrorLine message={createEnvironmentError?.message} className="mt-4" />
          )}
          <div className="mt-4 flex w-full flex-wrap items-center justify-end gap-2">
            <DialogClose asChild className="text-muted-foreground">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <form.Subscribe
              selector={(state) => ({ isSubmitting: state.isSubmitting })}
              children={({ isSubmitting }) => (
                <form.SubmitButton
                  data-submitting={isSubmitting || undefined}
                  isPending={isSubmitting ? true : false}
                >
                  Create
                </form.SubmitButton>
              )}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
