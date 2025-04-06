import { createStore } from "zustand/vanilla";

export type State = {
  isPendingId: string | null;
  search: string;
  inputValues: Record<string, string>;
};

export type Actions = {
  setIsPendingId: (isPendingId: string | null) => void;
  setSearch: (search: string) => void;
  setInputValue: (inputId: string, value: string) => void;
  clearInputValue: (inputId: string) => void;
};

export type CommandPanelStore = State & Actions;

const defaultInitState: State = {
  isPendingId: null,
  search: "",
  inputValues: {},
};

export const createCommandPanelStore = (initState: State = defaultInitState) => {
  return createStore<CommandPanelStore>()((set) => ({
    ...initState,
    setIsPendingId: (id) => {
      set((state) => ({ ...state, isPendingId: id }));
    },
    setInputValue: (id, value) => {
      set((state) => ({
        ...state,
        inputValues: {
          ...state.inputValues,
          [id]: value,
        },
      }));
    },
    clearInputValue: (id) => {
      set((state) => {
        const newState = { ...state };
        if (newState.inputValues[id]) {
          delete newState.inputValues[id];
        }
        return newState;
      });
    },
    setSearch: (search) => {
      set((state) => ({ ...state, search }));
    },
  }));
};
