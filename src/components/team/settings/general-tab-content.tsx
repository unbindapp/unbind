"use client";

import RenameCard from "@/components/settings/rename-card";
import { useTeam } from "@/components/team/team-provider";
import { useTeams } from "@/components/team/teams-provider";
import {
  teamDescriptionMaxLength,
  teamNameMaxLength,
  TeamUpdateFormSchema,
} from "@/server/types/teams";
import { updateTeam as updateTeamFn } from "@/api/services/teams";
import { useMutation } from "@tanstack/react-query";

type TProps = {
  teamId: string;
};

export default function GeneralTabContent({ teamId }: TProps) {
  const {
    query: { data, refetch: refetchTeam },
  } = useTeam();
  const { refetch: refetchTeams } = useTeams();

  const { mutateAsync: updateTeam, error } = useMutation({ mutationFn: updateTeamFn });

  return (
    <div className="flex w-full flex-col gap-3">
      <RenameCard
        type="team"
        onSubmit={async (value) => {
          await updateTeam({
            description: value.description || "",
            name: value.name,
            teamId,
          });
          await Promise.all([refetchTeam(), refetchTeams()]);
        }}
        name={data?.team.name}
        description={data?.team.description}
        nameMaxLength={teamNameMaxLength}
        descriptionMaxLength={teamDescriptionMaxLength}
        error={error}
        schema={TeamUpdateFormSchema}
      />
    </div>
  );
}
