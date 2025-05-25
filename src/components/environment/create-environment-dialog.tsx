"use client";

import { useEnvironmentsUtils } from "@/components/environment/environments-provider";
import ErrorLine from "@/components/error-line";
import { useProject, useProjectUtils } from "@/components/project/project-provider";
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
import { defaultAnimationMs } from "@/lib/constants";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  environmentNameMaxLength,
  EnvironmentNameSchema,
} from "@/server/trpc/api/environments/types";
import { api } from "@/server/trpc/setup/client";
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
  dialogOnOpenChange?: (open: boolean) => void;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function CreateEnvironmentDialog({
  children,
  onFormSubmitSuccessful,
  dialogOnOpenChange,
  ...rest
}: TCreateEnvironmentDialogProps) {
  const { teamId, projectId } = useProject();
  const {
    mutateAsync: createEnvironment,
    error: createEnvironmentError,
    reset: createEnvironmentReset,
  } = api.environments.create.useMutation();
  const { asyncPush } = useAsyncPush();
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

      const environmentId = res.data.id;
      invalidateProject();
      invalidateProjects();
      invalidateEnvironments();

      setOpen(false);
      onFormSubmitSuccessful?.();

      const asyncPushRes = await ResultAsync.fromPromise(
        asyncPush(`/${teamId}/project/${projectId}?environment=${environmentId}`),
        () => new Error("Failed to navigate"),
      );
      if (asyncPushRes.isErr()) {
        toast.error("Failed to navigate to project", {
          description: asyncPushRes.error.message,
        });
        return;
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
            form.handleSubmit();
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
                  data-submitting={isSubmitting ? true : undefined}
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
