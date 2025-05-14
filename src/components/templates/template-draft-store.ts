import { AppRouterOutputs } from "@/server/trpc/api/root";
import { createStore } from "zustand/vanilla";

type TTemplateDraft = {
  id: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  template: AppRouterOutputs["templates"]["list"]["templates"][number];
  groupName: string;
};

export type TState = {
  templateDrafts: TTemplateDraft[];
};

export type TActions = {
  add: (templateInstance: TTemplateDraft) => void;
  remove: (id: string) => void;
};

export type TTemplateDraftStore = TState & TActions;

const defaultInitState: TState = {
  templateDrafts: [],
};

export const createTemplateDraftStore = (initState: TState = defaultInitState) => {
  return createStore<TTemplateDraftStore>()((set) => ({
    ...initState,
    add: (instance) => {
      set((state) => ({ ...state, templateDrafts: [...state.templateDrafts, instance] }));
    },
    remove: (id) => {
      set((state) => ({
        ...state,
        templateDrafts: state.templateDrafts.filter((instance) => instance.id !== id),
      }));
    },
  }));
};
