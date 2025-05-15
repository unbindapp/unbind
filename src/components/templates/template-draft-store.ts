import { AppRouterOutputs } from "@/server/trpc/api/root";
import { createStore } from "zustand/vanilla";

export type TTemplateDraft = {
  id: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  name: string;
  description?: string;
  template: AppRouterOutputs["templates"]["list"]["templates"][number];
};

export type TState = {
  templateDrafts: TTemplateDraft[];
};

export type TActions = {
  add: (templateInstance: TTemplateDraft) => void;
  remove: (id: string) => void;
  update: (id: string, templateInstance: Partial<TTemplateDraft>) => void;
};

export type TTemplateDraftStore = TState & TActions;

const defaultInitState: TState = {
  templateDrafts: [],
};

export const createTemplateDraftStore = (initState: TState = defaultInitState) => {
  return createStore<TTemplateDraftStore>()((set) => ({
    ...initState,
    add: (draft) => {
      set((state) => ({ ...state, templateDrafts: [draft, ...state.templateDrafts] }));
    },
    remove: (id) => {
      set((state) => ({
        ...state,
        templateDrafts: state.templateDrafts.filter((instance) => instance.id !== id),
      }));
    },
    update: (id, newProperties) => {
      set((state) => ({
        ...state,
        templateDrafts: state.templateDrafts.map((draft) =>
          draft.id === id ? { ...draft, ...newProperties } : draft,
        ),
      }));
    },
  }));
};
