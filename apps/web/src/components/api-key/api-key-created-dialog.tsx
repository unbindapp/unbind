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
import { Input } from "@/components/ui/input";
import { getConfig } from "@/lib/config";
import type { TApiKeyCreated } from "@/lib/queries/api-keys";
import { TriangleAlertIcon } from "lucide-react";

type TProps = {
  created: TApiKeyCreated | null;
  onClose: () => void;
};

export default function ApiKeyCreatedDialog({ created, onClose }: TProps) {
  const curl = `curl -H "Authorization: Bearer ${created?.token ?? ""}" ${getConfig().apiUrl}/users/me`;
  return (
    <Dialog
      open={created !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="w-xl max-w-full">
        <DialogHeader>
          <DialogTitle>API key created</DialogTitle>
          <DialogDescription>
            {created ? `"${created.name}" is ready.` : ""} Copy the key now, it will not be shown
            again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex w-full flex-col gap-3">
          <div className="flex w-full items-center gap-2">
            <Input
              readOnly
              value={created?.token ?? ""}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 font-mono text-sm"
              aria-label="API key"
            />
            <CopyButton valueToCopy={created?.token} variant="outline" className="rounded-lg" />
          </div>
          <div className="bg-warning/3-10 text-warning flex w-full items-start gap-1.5 rounded-md px-3 py-2 text-sm font-medium">
            <TriangleAlertIcon className="mt-px size-4.5 shrink-0" />
            <p className="min-w-0 flex-1 leading-tight">
              Store it somewhere safe. If you lose it, revoke this key and create a new one.
            </p>
          </div>
          <div className="relative w-full">
            <pre className="bg-card w-full overflow-x-auto rounded-lg border p-3 pr-12 font-mono text-xs leading-relaxed">
              {curl}
            </pre>
            <CopyButton valueToCopy={curl} className="absolute top-1.5 right-1.5" />
          </div>
        </div>
        <div className="flex w-full justify-end">
          <DialogClose render={<Button>Done</Button>} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
