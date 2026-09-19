"use client";

import { CreateProjectDialog } from "@/components/project/create-project-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { PlusIcon } from "lucide-react";

type TProps = {
  teamId: string;
  className?: string;
};

export default function NewProjectButton({ teamId, className }: TProps) {
  return (
    <CreateProjectDialog teamId={teamId}>
      <Button
        className={cn("bg-card -my-2 rounded-lg py-2", className)}
        size="sm"
        variant="outline"
      >
        <PlusIcon className="-ml-1.5 size-5" />
        <p className="min-w-0 shrink">New Project</p>
      </Button>
    </CreateProjectDialog>
  );
}
