"use client";

import { useProject } from "@/app/(project)/[team_id]/project/[project_id]/environment/[environment_id]/_components/project-provider";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { ProjectUpdateFormSchema } from "@/server/trpc/api/projects/types";
import { api } from "@/server/trpc/setup/client";
import { LoaderIcon } from "lucide-react";

type TProps = {
  projectId: string;
  teamId: string;
};

export default function GeneralTabContent({ teamId, projectId }: TProps) {
  const { data } = useProject();

  const { mutateAsync: updateProject } = api.projects.update.useMutation();

  const form = useAppForm({
    defaultValues: {
      displayName: data?.project.display_name || "",
      description: data?.project.description || "",
    },
    validators: {
      onChange: ProjectUpdateFormSchema,
    },
    onSubmit: async ({ value }) => {
      await updateProject({
        description: value.description,
        displayName: value.displayName,
        projectId,
        teamId,
      });
    },
  });

  return (
    <div className="flex w-full flex-col">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="flex w-full flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-3"
      >
        <form.AppField
          name="displayName"
          children={(field) => (
            <field.TextField
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
            <form.SubmitButton
              data-submitting={isSubmitting ? true : undefined}
              className="group/button"
              disabled={
                !canSubmit ||
                (typeof values === "object" &&
                  values.displayName === data?.project.display_name &&
                  values.description === data?.project.description)
              }
            >
              <LoaderIcon className="pointer-events-none absolute top-1/2 left-1/2 -translate-1/2 animate-spin opacity-0 group-data-submitting/button:opacity-100" />
              <p className="group-data-submitting/button:pointer-events-none group-data-submitting/button:opacity-0">
                Save
              </p>
            </form.SubmitButton>
          )}
        />
      </form>
    </div>
  );
}
