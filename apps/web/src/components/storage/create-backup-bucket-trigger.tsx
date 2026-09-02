import { NewS3BucketTrigger } from "@/components/storage/s3-bucket-card";
import { splitS3BucketItemLabel } from "@/components/service/helpers";
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

export type TCreateBackupBucketTriggerProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  children: ReactElement;
  teamId: string;
};

export function CreateBackupBucketTrigger({
  teamId,
  isOpen,
  setIsOpen,
  children,
}: TCreateBackupBucketTriggerProps) {
  const [dialogHandle] = useState(() => createDialogHandle());

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger render={children} />
        <DropdownMenuContent animate={false} className="w-(--anchor-width)">
          <ScrollArea>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="-mx-1 mb-1 border-b px-3 pb-2 font-normal">
                {"You don't have any buckets. Create a backup bucket."}
              </DropdownMenuLabel>
              {/* The dialog lives outside the menu; nested inside the open modal menu it would be inert */}
              <DialogTrigger
                nativeButton={false}
                handle={dialogHandle}
                render={
                  <DropdownMenuItem className="gap-1.5">
                    <PlusIcon className="-ml-1 size-5" />
                    <p className="min-w-0 shrink">Create Backup Bucket</p>
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuGroup>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
      <NewS3BucketTrigger teamId={teamId} handle={dialogHandle} />
    </>
  );
}

export function S3BucketLabel({ name, bucket }: { name: string; bucket: string }) {
  return (
    <>
      {name}
      <span className="text-muted-more-foreground px-[0.5ch]">/</span>
      {bucket}
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
  const { name, bucket } = splitS3BucketItemLabel(item.label);
  return (
    <p className={cn("min-w-0 shrink leading-tight", className)}>
      <S3BucketLabel name={name} bucket={bucket} />
    </p>
  );
}
