import { queryKeyStorage } from "@/lib/queries/storage";
import { useQueryClient } from "@tanstack/react-query";

export const useVolumesUtils = ({
  teamId,
  projectId,
  environmentId,
}: {
  teamId: string;
  projectId: string;
  environmentId: string;
}) => {
  const queryClient = useQueryClient();
  const queryKey = queryKeyStorage.volumeList({ teamId, projectId, environmentId });
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
    refetch: () => queryClient.refetchQueries({ queryKey }),
  };
};
