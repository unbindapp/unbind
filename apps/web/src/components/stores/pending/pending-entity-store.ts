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

export type TState = {
  pendingServices: TPendingService[];
};

export type TActions = {
  addPendingService: (service: TPendingService) => void;
  removePendingService: (id: string) => void;
};

export type TPendingEntityStore = TState & TActions;

// In-memory only: a reload must not resurrect a placeholder for a request that is gone
export const createPendingEntityStore = () =>
  createStore<TPendingEntityStore>()((set) => ({
    pendingServices: [],
    addPendingService: (service) =>
      set((state) => ({ pendingServices: [service, ...state.pendingServices] })),
    removePendingService: (id) =>
      set((state) => ({ pendingServices: state.pendingServices.filter((s) => s.id !== id) })),
  }));
