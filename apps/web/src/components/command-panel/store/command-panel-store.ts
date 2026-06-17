import { createStore } from "zustand/vanilla";

export type TState = {
  value: string;
  isPendingId: string | null;
  search: string;
  inputValues: Record<string, string>;
  prevItemId: string | null;
};

export type TActions = {
  setValue: (value: string) => void;
  setIsPendingId: (isPendingId: string | null) => void;
  setSearch: (search: string) => void;
  setInputValue: (inputId: string, value: string) => void;
  setPrevItemId: (prevItemId: string | null) => void;
  clearInputValue: (inputId: string) => void;
};

export type TCommandPanelStore = TState & TActions;

const defaultInitState: TState = {
  value: "",
  isPendingId: null,
  prevItemId: null,
  search: "",
  inputValues: {},
};

export const createCommandPanelStore = (initState: TState = defaultInitState) => {
  return createStore<TCommandPanelStore>()((set) => ({
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
    setValue: (value) => {
      set((state) => ({ ...state, value }));
    },
    setPrevItemId: (prevItemId) => {
      set((state) => ({ ...state, prevItemId }));
    },
    setSearch: (search) => {
      set((state) => ({ ...state, search }));
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
  }));
};
