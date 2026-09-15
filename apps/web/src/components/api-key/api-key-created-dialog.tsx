"use client";

import CopyButton from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TApiKeyCreated } from "@/lib/queries/api-keys";
import { TriangleAlertIcon } from "lucide-react";

type TProps = {
  created: TApiKeyCreated | null;
  onClose: () => void;
};

export default function ApiKeyCreatedDialog({ created, onClose }: TProps) {
  return (
    <Dialog
      open={created !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent hideXButton={true} className="w-xl max-w-full">
        <DialogHeader>
          <DialogTitle>API key created</DialogTitle>
          <DialogDescription className="max-w-full">
            {created ? (
              <>
                <span className="text-foreground bg-foreground/2-10 border-foreground/2-10 rounded-md border px-1.25">
                  {created.name}
                </span>{" "}
                is ready.
              </>
            ) : (
              ""
            )}{" "}
            Keep it safe, it will not be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex w-full flex-col gap-3">
          <div className="flex w-full items-start gap-2">
            <p
              className="bg-input min-w-0 flex-1 rounded-lg border px-3 py-2.5 font-mono text-sm"
              aria-label="API key"
            >
              {created?.token ?? ""}
            </p>
            <CopyButton
              valueToCopy={created?.token}
              variant="outline"
              className="size-10.5 rounded-lg"
            />
          </div>
          <div className="bg-warning/3-10 text-warning flex w-full items-start gap-1.5 rounded-md px-3 py-2 text-sm font-medium">
            <TriangleAlertIcon className="mt-px size-4.5 shrink-0" />
            <p className="min-w-0 flex-1 leading-tight">
              Copy the key now, it will not be shown again.
            </p>
          </div>
        </div>
        <div className="flex w-full justify-end">
          <DialogClose render={<Button>Done</Button>} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
