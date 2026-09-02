import { Mutation, useMutationState } from "@tanstack/react-query";

export const deleteMutationKeys = {
  service: (id: string) => ["delete-service", id],
  serviceGroup: (id: string) => ["delete-service-group", id],
  volume: (id: string) => ["delete-volume", id],
  project: (id: string) => ["delete-project", id],
};

// Stays true after success so the card keeps its deleting look until the refetch drops it
const isDeleteInFlight = (mutation: Mutation) =>
  mutation.state.status === "pending" || mutation.state.status === "success";

export function useIsDeleting(mutationKey: readonly unknown[]) {
  const matches = useMutationState({
    filters: { mutationKey, exact: true, predicate: isDeleteInFlight },
    select: (mutation) => mutation.state.status,
  });
  return matches.length > 0;
}
