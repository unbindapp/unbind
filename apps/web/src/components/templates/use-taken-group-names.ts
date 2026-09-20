import { useTakenServiceNames } from "@/components/service/use-taken-service-names";
import { useTemplateDraftStore } from "@/components/templates/template-draft-store-provider";
import { useMemo } from "react";

// A draft turns into a service group once deployed, so its name has to be free among both
export function useTakenGroupNames(input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  excludeDraftId?: string;
}) {
  const { teamId, projectId, environmentId, excludeDraftId } = input;
  const { groupNames } = useTakenServiceNames({ teamId, projectId, environmentId });
  const drafts = useTemplateDraftStore((s) => s.templateDrafts);

  return useMemo(() => {
    const draftNames = drafts
      .filter((d) => d.environmentId === environmentId && d.id !== excludeDraftId && !d.hidden)
      .map((d) => d.name);
    return { groupNames, groupAndDraftNames: [...groupNames, ...draftNames] };
  }, [groupNames, drafts, environmentId, excludeDraftId]);
}
