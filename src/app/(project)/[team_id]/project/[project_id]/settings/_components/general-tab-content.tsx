"use client";

import { useProject } from "@/app/(project)/[team_id]/project/[project_id]/_components/project-provider";
import ErrorLine from "@/components/error-line";
import { useProjects } from "@/components/project/projects-provider";
import { Button } from "@/components/ui/button";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { ProjectUpdateFormSchema } from "@/server/trpc/api/projects/types";
import { api } from "@/server/trpc/setup/client";
import { LoaderIcon, RotateCcwIcon, SaveIcon } from "lucide-react";

type TProps = {
  projectId: string;
  teamId: string;
};

export default function GeneralTabContent({ teamId, projectId }: TProps) {
  const { data, refetch: refetchProject } = useProject();
  const { refetch: refetchProjects } = useProjects();

  const { mutateAsync: updateProject, error } = api.projects.update.useMutation();

  const form = useAppForm({
    defaultValues: {
      displayName: data?.project.display_name || "",
      description: data?.project.description || undefined,
    },
    validators: {
      onChange: ProjectUpdateFormSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      await updateProject({
        description: value.description || "",
        displayName: value.displayName,
        projectId,
        teamId,
      });
      await Promise.all([refetchProject(), refetchProjects()]);
      formApi.reset();
    },
  });

  return (
    <div className="flex w-full flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="flex w-full flex-col gap-3 lg:flex-row lg:items-start"
      >
        <form.AppField
          name="displayName"
          children={(field) => (
            <field.TextField
              field={field}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              layout="label-included"
              inputTitle="Project Name"
              className="flex-1"
            />
          )}
        />
        <form.AppField
          name="description"
          children={(field) => (
            <field.TextField
              field={field}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              layout="label-included"
              inputTitle="Project Description"
              className="flex-1"
            />
          )}
        />
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting, state.values]}
          children={([canSubmit, isSubmitting, values]) => (
            <div className="flex w-full flex-row gap-3 lg:w-auto">
              <form.SubmitButton
                data-submitting={isSubmitting ? true : undefined}
                className="group/button flex-1 lg:py-3.5"
                disabled={
                  !canSubmit ||
                  (typeof values === "object" &&
                    values.displayName === data?.project.display_name &&
                    values.description === data?.project.description)
                }
              >
                <LoaderIcon className="pointer-events-none absolute top-1/2 left-1/2 -translate-1/2 animate-spin opacity-0 group-data-submitting/button:opacity-100" />
                <div className="flex min-w-0 shrink items-center justify-center gap-1.5 group-data-submitting/button:pointer-events-none group-data-submitting/button:opacity-0">
                  <SaveIcon className="-ml-1 size-4.5 shrink-0" />
                  <p className="min-w-0 shrink">Save</p>
                </div>
              </form.SubmitButton>
              <Button
                disabled={
                  typeof values === "object" &&
                  values.displayName === data?.project.display_name &&
                  values.description === data?.project.description
                }
                onClick={() => form.reset()}
                variant="outline"
                className="gap-1.5"
              >
                <RotateCcwIcon
                  data-rotated={
                    typeof values === "object" &&
                    values.displayName === data?.project.display_name &&
                    values.description === data?.project.description
                      ? true
                      : undefined
                  }
                  className="-ml-1 size-4.5 shrink-0 transition-transform data-rotated:-rotate-135"
                />
                <p className="min-w-0">Undo</p>
              </Button>
            </div>
          )}
        />
      </form>
      {error && <ErrorLine message={error.message} />}
    </div>
  );
}
