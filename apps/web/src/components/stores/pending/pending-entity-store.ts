import { createStore } from "zustand/vanilla";

export type TPendingService = {
  id: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  name: string;
  icon: string;
  createdAt: string;
};

export type TPendingProject = {
  id: string;
  teamId: string;
  name: string;
  createdAt: string;
};

export type TState = {
  pendingServices: TPendingService[];
  pendingProjects: TPendingProject[];
};

export type TActions = {
  addPendingService: (service: TPendingService) => void;
  removePendingService: (id: string) => void;
  addPendingProject: (project: TPendingProject) => void;
  removePendingProject: (id: string) => void;
};

export type TPendingEntityStore = TState & TActions;

// In-memory only: a reload must not resurrect a placeholder for a request that is gone
export const createPendingEntityStore = () =>
  createStore<TPendingEntityStore>()((set) => ({
    pendingServices: [],
    pendingProjects: [],
    addPendingService: (service) =>
      set((state) => ({ pendingServices: [service, ...state.pendingServices] })),
    removePendingService: (id) =>
      set((state) => ({ pendingServices: state.pendingServices.filter((s) => s.id !== id) })),
    addPendingProject: (project) =>
      set((state) => ({ pendingProjects: [project, ...state.pendingProjects] })),
    removePendingProject: (id) =>
      set((state) => ({ pendingProjects: state.pendingProjects.filter((p) => p.id !== id) })),
  }));
