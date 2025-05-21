import { createJSONZodStorage } from "@/lib/create-json-zod-storage";
import { TemplateWithDefinitionResponseSchema } from "@/server/go/client.gen";
import { z } from "zod";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

export type TTemplateWithDefinition = z.infer<typeof TemplateWithDefinitionResponseSchema>;
export type TTemplateInput = TTemplateWithDefinition["definition"]["inputs"][number];
export type TTemplateInputType = TTemplateInput["type"];

const TemplateDraftSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  projectId: z.string(),
  environmentId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  template: TemplateWithDefinitionResponseSchema,
  createdAt: z.string(),
  hidden: z.boolean().optional(),
});

export type TTemplateDraft = z.infer<typeof TemplateDraftSchema>;

const TemplateDraftStoreSchema = z.object({
  templateDrafts: TemplateDraftSchema.array(),
});

export type TState = z.infer<typeof TemplateDraftStoreSchema>;

export type TActions = {
  add: (templateInstance: TTemplateDraft) => Promise<void>;
  remove: (id: string) => Promise<void>;
  hide: (id: string) => Promise<void>;
  update: (id: string, templateInstance: Partial<TTemplateDraft>) => Promise<void>;
};

export type TTemplateDraftStore = TState & TActions;

const defaultInitState: TState = {
  templateDrafts: [],
};

const version = 0.001;
const maxTemplatesToStore = 10;

export const createTemplateDraftStore = (initState: TState = defaultInitState) => {
  return createStore<TTemplateDraftStore>()(
    persist(
      (set) => ({
        ...initState,
        add: async (draft) => {
          set((state) => ({
            ...state,
            templateDrafts: [draft, ...state.templateDrafts].slice(0, maxTemplatesToStore),
          }));
        },
        remove: async (id) => {
          set((state) => ({
            ...state,
            templateDrafts: state.templateDrafts.filter((instance) => instance.id !== id),
          }));
        },
        hide: async (id) => {
          set((state) => ({
            ...state,
            templateDrafts: state.templateDrafts.map((draft) =>
              draft.id === id ? { ...draft, hidden: true } : draft,
            ),
          }));
        },
        update: async (id, newProperties) => {
          set((state) => ({
            ...state,
            templateDrafts: state.templateDrafts.map((draft) =>
              draft.id === id ? { ...draft, ...newProperties } : draft,
            ),
          }));
        },
      }),
      {
        name: "template_draft_store",
        version,
        migrate: (state): TState => {
          const { error, data } = TemplateDraftStoreSchema.safeParse(state);
          if (error) {
            console.log("Error on migration, falling back to empty TemplateDraftStore:", error);
            return initState;
          }
          return data;
        },
        storage: createJSONZodStorage({
          getStorage: () => localStorage,
          schema: TemplateDraftStoreSchema,
          fallback: initState,
          version,
        }),
      },
    ),
  );
};
