import { AddS3BucketTrigger } from "@/components/storage/s3-bucket-card";
import { createDialogHandle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { TCommandItem } from "@/lib/hooks/use-app-form";
import { PlusIcon } from "lucide-react";
import { ReactElement, useState } from "react";

export type TAddBackupBucketTriggerProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  children: ReactElement;
  teamId: string;
};

export function AddBackupBucketTrigger({
  teamId,
  isOpen,
  setIsOpen,
  children,
}: TAddBackupBucketTriggerProps) {
  const [dialogHandle] = useState(() => createDialogHandle());

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger render={children} />
        <DropdownMenuContent animate={false} className="w-(--anchor-width)">
          <ScrollArea>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="-mx-1 mb-1 border-b px-3 pb-2 font-normal">
                {"You don't have any buckets. Add one first."}
              </DropdownMenuLabel>
              {/* The dialog lives outside the menu; nested inside the open modal menu it would be inert */}
              <DialogTrigger
                nativeButton={false}
                handle={dialogHandle}
                render={
                  <DropdownMenuItem className="gap-1.5">
                    <PlusIcon className="-ml-1 size-5" />
                    <p className="min-w-0 shrink">Add Backup Bucket</p>
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuGroup>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
      <AddS3BucketTrigger teamId={teamId} handle={dialogHandle} />
    </>
  );
}

export function S3BucketLabel({ name, bucket }: { name: string; bucket: string }) {
  return (
    <>
      <span className="pr-2">{name}</span>
      <span className="bg-foreground/6 border-foreground/6 -my-1 rounded-sm border px-1.25 font-mono text-sm font-normal">
        {bucket}
      </span>
    </>
  );
}

export function S3BucketCommandItemElement({
  item,
  className,
}: {
  item: TCommandItem;
  className?: string;
}) {
  return (
    <p className={cn("min-w-0 leading-tight", className)}>
      <S3BucketLabel name={item.label} bucket={item.description ?? ""} />
    </p>
  );
}
