"use client";

import { CreateProjectDialog } from "@/components/project/create-project-dialog";
import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type TCreateProjectDialogContext = {
  openCreateProjectDialog: () => void;
};

const CreateProjectDialogContext = createContext<TCreateProjectDialogContext | null>(null);

type TProps = {
  teamId: string;
  children: ReactNode;
};

export default function CreateProjectDialogProvider({ teamId, children }: TProps) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ openCreateProjectDialog: () => setOpen(true) }), []);

  return (
    <CreateProjectDialogContext.Provider value={value}>
      {children}
      <CreateProjectDialog teamId={teamId} open={open} onOpenChange={setOpen} />
    </CreateProjectDialogContext.Provider>
  );
}

// Null outside the team layout
export function useCreateProjectDialog() {
  return useContext(CreateProjectDialogContext);
}
