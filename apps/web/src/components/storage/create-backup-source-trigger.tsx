import { NewS3SourceTrigger } from "@/components/storage/s3-source-card";
import { sourceAndBucketSeparator } from "@/components/service/helpers";
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

export type TCreateBackupSourceTriggerProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  children: ReactElement;
  teamId: string;
};

export function CreateBackupSourceTrigger({
  teamId,
  isOpen,
  setIsOpen,
  children,
}: TCreateBackupSourceTriggerProps) {
  const [dialogHandle] = useState(() => createDialogHandle());

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger render={children} />
        <DropdownMenuContent animate={false} className="w-(--anchor-width)">
          <ScrollArea>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="-mx-1 mb-1 border-b px-3 pb-2 font-normal">
                {"You don't have any buckets. Create a backup source."}
              </DropdownMenuLabel>
              {/* The dialog lives outside the menu; nested inside the open modal menu it would be inert */}
              <DialogTrigger
                nativeButton={false}
                handle={dialogHandle}
                render={
                  <DropdownMenuItem className="gap-1.5">
                    <PlusIcon className="-ml-1 size-5" />
                    <p className="min-w-0 shrink">Create Backup Source</p>
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuGroup>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
      <NewS3SourceTrigger teamId={teamId} handle={dialogHandle} />
    </>
  );
}

export function SourceAndBucketCommandItemElement({
  item,
  className,
}: {
  item: TCommandItem;
  className?: string;
}) {
  return (
    <p className={cn("min-w-0 shrink leading-tight", className)}>
      {item.label.split(sourceAndBucketSeparator)[0]}
      <span className="text-muted-more-foreground px-[0.5ch]">/</span>
      {item.label.split(sourceAndBucketSeparator)[1]}
    </p>
  );
}
