"use client";

import ErrorLine from "@/components/error-line";
import { useTeam } from "@/components/team/team-provider";
import { useTeams } from "@/components/team/teams-provider";
import { Button } from "@/components/ui/button";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  teamDescriptionMaxLength,
  teamNameMaxLength,
  TeamUpdateFormSchema,
} from "@/server/trpc/api/teams/types";
import { api } from "@/server/trpc/setup/client";
import { LoaderIcon, RotateCcwIcon, SaveIcon } from "lucide-react";

type TProps = {
  teamId: string;
};

export default function GeneralTabContent({ teamId }: TProps) {
  const {
    query: { data, refetch: refetchTeam },
  } = useTeam();
  const { refetch: refetchTeams } = useTeams();

  const { mutateAsync: updateTeam, error } = api.teams.update.useMutation();

  const form = useAppForm({
    defaultValues: {
      displayName: data?.team.display_name || "",
      description: data?.team.description || "",
    },
    validators: {
      onChange: TeamUpdateFormSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      await updateTeam({
        description: value.description || "",
        displayName: value.displayName,
        teamId,
      });
      await Promise.all([refetchTeam(), refetchTeams()]);
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
        className="flex w-full flex-col gap-3 xl:flex-row xl:items-start"
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
              inputTitle="Team Name"
              className="flex-1 xl:max-w-72"
              maxLength={teamNameMaxLength}
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
              inputTitle="Team Description"
              className="flex-1"
              maxLength={teamDescriptionMaxLength}
            />
          )}
        />
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting, state.values]}
          children={([canSubmit, isSubmitting, values]) => {
            const valuesUnchanged =
              typeof values === "object" &&
              values.displayName === data?.team.display_name &&
              looseMatch(values.description, data?.team.description);
            return (
              <div className="flex w-full flex-row gap-3 md:w-auto">
                <form.SubmitButton
                  data-submitting={isSubmitting ? true : undefined}
                  className="group/button flex-1 md:flex-none xl:py-3.75"
                  disabled={!canSubmit || valuesUnchanged}
                >
                  <div className="-ml-1 size-5 shrink-0">
                    {isSubmitting ? (
                      <LoaderIcon className="size-full animate-spin" />
                    ) : (
                      <SaveIcon className="size-full" />
                    )}
                  </div>
                  <p className="min-w-0 shrink">Save</p>
                </form.SubmitButton>
                <Button
                  disabled={valuesUnchanged}
                  onClick={() => form.reset()}
                  variant="outline"
                  className="gap-1.5 xl:py-3.75"
                >
                  <RotateCcwIcon
                    data-rotated={valuesUnchanged ? true : undefined}
                    className="-ml-1 size-5 shrink-0 transition-transform data-rotated:-rotate-135"
                  />
                  <p className="min-w-0">Undo</p>
                </Button>
              </div>
            );
          }}
        />
      </form>
      {error && <ErrorLine message={error.message} />}
    </div>
  );
}

function looseMatch(a: string | null, b: string | null) {
  const _a = a || "";
  const _b = b || "";
  return _a === _b;
}
