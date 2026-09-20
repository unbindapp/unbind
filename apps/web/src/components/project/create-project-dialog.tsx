"use client";

import ErrorLine from "@/components/error-line";
import { useCreateAndOpenProject } from "@/components/project/use-create-and-open-project";
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
import { generateProjectName } from "@/lib/helpers/generate-project-name";
import { getTakenNameError, getUniqueName } from "@/lib/helpers/unique-name";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  ProjectCreateFormSchema,
  projectNameMaxLength,
  projectsListQuery,
} from "@/lib/queries/projects";
import { useQuery } from "@tanstack/react-query";
import { ResultAsync } from "neverthrow";
import { ReactElement, useState } from "react";

export type TCreateProjectDialogProps = {
  teamId: string;
  children: ReactElement;
  dialogOnOpenChange?: (open: boolean) => void;
};

export function CreateProjectDialog({
  teamId,
  children,
  dialogOnOpenChange,
}: TCreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [generatedName, setGeneratedName] = useState(generateProjectName);

  const {
    mutateAsync: createAndOpenProject,
    error: createProjectError,
    reset: createProjectReset,
  } = useCreateAndOpenProject({ teamId });

  const { data: projectsData } = useQuery(projectsListQuery({ teamId }));
  const uniqueAmong = {
    names: projectsData?.projects.map((p) => p.name) ?? [],
    entity: "a project",
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    dialogOnOpenChange?.(o);
  };

  const form = useAppForm({
    defaultValues: {
      name: "",
    },
    validators: {
      onChange: ProjectCreateFormSchema,
    },
    onSubmit: async ({ value }) => {
      const res = await ResultAsync.fromPromise(
        createAndOpenProject(
          value.name.trim() ||
            getUniqueName(generatedName, uniqueAmong.names, projectNameMaxLength),
        ),
        () => null,
      );
      if (res.isErr()) return;

      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(o) => {
        if (o) return;
        form.reset();
        createProjectReset();
        setGeneratedName(generateProjectName());
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <DialogDescription>
            Enter a name, or leave it empty to use the generated one.
          </DialogDescription>
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
            validators={{
              onChange: ({ value }) => getTakenNameError(value, uniqueAmong),
            }}
            children={(field) => (
              <field.TextField
                autoCapitalize="none"
                dontCheckUntilSubmit
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full"
                placeholder={generatedName}
                maxLength={projectNameMaxLength}
              />
            )}
          />
          {createProjectError && (
            <ErrorLine message={createProjectError.message} className="mt-4" />
          )}
          <div className="mt-4 flex w-full flex-wrap items-center justify-end gap-2">
            <DialogClose
              className="text-muted-foreground"
              render={
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              }
            />
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
