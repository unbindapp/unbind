import { useMutationState } from "@tanstack/react-query";

export const deployMutationKeys = {
  template: (templateDraftId: string) => ["deploy-template", templateDraftId],
  firstDeployment: (serviceId: string) => ["create-first-deployment", serviceId],
};

// Read from the mutation cache, so it outlives the component that started the mutation
export function useSharedMutation(mutationKey: readonly unknown[]) {
  const states = useMutationState({
    filters: { mutationKey, exact: true },
    select: (mutation) => mutation.state,
  });
  const last = states.at(-1);

  return {
    isPending: states.some((state) => state.status === "pending"),
    error: last?.status === "error" ? last.error : null,
  };
}
