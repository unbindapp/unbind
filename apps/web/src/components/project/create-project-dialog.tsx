"use client";

import ErrorLine from "@/components/error-line";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
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
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  createProject as createProjectFn,
  ProjectCreateFormSchema,
  projectNameMaxLength,
} from "@/lib/queries/projects";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { ResultAsync } from "neverthrow";
import { ReactElement, useState } from "react";

export type TCreateProjectDialogProps = {
  teamId: string;
  dialogOnOpenChange?: (open: boolean) => void;
} & (
  | { children: ReactElement; open?: never; onOpenChange?: never }
  | { children?: never; open: boolean; onOpenChange: (open: boolean) => void }
);

export function CreateProjectDialog({
  teamId,
  dialogOnOpenChange,
  children,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: TCreateProjectDialogProps) {
  const router = useRouter();
  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();
  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId });

  const [openLocal, setOpenLocal] = useState(false);
  const open = openProp !== undefined ? openProp : openLocal;
  const setOpen = onOpenChangeProp !== undefined ? onOpenChangeProp : setOpenLocal;

  const [generatedName, setGeneratedName] = useState(generateProjectName);

  const {
    mutateAsync: createAndOpenProject,
    error: createProjectError,
    reset: createProjectReset,
  } = useMutation({
    mutationFn: async (name: string) => {
      const { data: project } = await createProjectFn({ teamId, name });
      const environmentId = project.default_environment_id || project.environments[0]?.id;
      if (!environmentId) throw new Error("There is no environment in the new project");

      temporarilyAddNewEntity(project.id);
      await invalidateProjects();
      await router.navigate({
        to: "/$team_id/project/$project_id",
        params: { team_id: teamId, project_id: project.id },
        search: { environment: environmentId },
      });
    },
  });

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
        createAndOpenProject(value.name.trim() || generatedName),
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
      {children && <DialogTrigger render={children} />}
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
