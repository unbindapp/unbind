"use client";

import DeleteCard from "@/components/settings/delete-card";
import { useTeam } from "@/components/team/team-provider";
import { deleteTeam as deleteTeamFn, queryKeyTeams } from "@/lib/queries/teams";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

export default function DeleteTeamSection({ className }: { className?: string }) {
  const {
    teamId,
    query: { data },
  } = useTeam();
  const queryClient = useQueryClient();
  const router = useRouter();

  const {
    mutateAsync: deleteTeam,
    error,
    reset,
  } = useMutation({
    mutationFn: deleteTeamFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeyTeams.list() }),
  });

  return (
    <DeleteCard
      dialogTitle="Delete Team"
      dialogDescription={
        <>
          Are you sure you want to delete this team? This action cannot be undone.{" "}
          <span className="text-foreground font-semibold">
            Every project, service, volume and bucket in this team will be permanently deleted.
          </span>
        </>
      }
      paragraph="This action cannot be undone. Every project, service, volume and bucket in this team will be permanently deleted."
      buttonText="Delete Team"
      error={error}
      deletingEntityName={data?.team.name || "the team"}
      onDialogClose={reset}
      onSubmit={async () => {
        await deleteTeam({ teamId });
        await router.navigate({ to: "/" });
      }}
      className={className}
    />
  );
}
