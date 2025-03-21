"use client";

import ErrorLine from "@/components/error-line";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { api } from "@/server/trpc/setup/client";
import { LoaderIcon, TriangleAlertIcon } from "lucide-react";
import { useRef, useState } from "react";

type Props = {
  className?: string;
};

export default function DeleteProjectSection({ className }: Props) {
  const { teamId, projectId } = useIdsFromPathname();
  return (
    <div
      className={cn(
        "bg-destructive/8 text-destructive flex w-full max-w-xl flex-col items-start justify-start gap-4 rounded-xl px-4 py-4",
        className,
      )}
    >
      <div className="-mt-0.75 flex w-full items-center justify-start gap-2 px-1">
        <TriangleAlertIcon className="size-5 shrink-0" />
        <p className="min-w-0 shrink leading-snug text-balance">
          Proceed with caution! Deleting this project will delete all environments and services
          inside it. This action cannot be undone.
        </p>
      </div>
      {teamId && projectId && <DeleteButton teamId={teamId} projectId={projectId} />}
    </div>
  );
}

function DeleteButton({ teamId, projectId }: { teamId: string; projectId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const textToConfirm = "I want to delete this project permanently";
  const [inputValue, setInputValue] = useState("");
  const { asyncPush } = useAsyncPush();
  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId });

  const {
    mutate: deleteProject,
    isPending: isProjectDeleting,
    error,
    reset,
  } = api.projects.delete.useMutation({
    onSuccess: async () => {
      invalidateProjects();
      await asyncPush(`/${teamId}`);
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inputValue !== textToConfirm) return;
    deleteProject({ teamId, projectId });
  }

  const timeout = useRef<NodeJS.Timeout>(undefined);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(o) => {
        setIsDialogOpen(o);
        if (!o) {
          if (timeout.current) clearTimeout(timeout.current);
          timeout.current = setTimeout(() => {
            setInputValue("");
            reset();
          }, 200);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">Delete Project</Button>
      </DialogTrigger>
      <DialogContent hideXButton className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this project? This action cannot be undone. All the
            services and data inside this project will be permanently deleted.
            <br />
            <br />
            Type {`"`}
            <span className="text-destructive font-semibold">{textToConfirm}</span>
            {`"`} to confirm.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="mt-2 flex flex-col">
          <Input onInput={(e) => setInputValue(e.currentTarget.value)} value={inputValue} />
          {error && <ErrorLine message={error?.message} className="mt-4" />}
          <div className="mt-4 flex w-full flex-wrap items-center justify-end gap-2">
            <DialogClose asChild className="text-muted-foreground">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button
              disabled={inputValue !== textToConfirm || isProjectDeleting}
              type="submit"
              className="group/button max-w-full"
              variant="destructive"
              data-pending={isProjectDeleting ? true : undefined}
            >
              {isProjectDeleting && (
                <LoaderIcon className="absolute top-1/2 left-1/2 -translate-1/2 animate-spin" />
              )}
              <p className="min-w-0 group-data-pending/button:opacity-0">Delete</p>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
