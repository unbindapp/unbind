import { NewS3SourceTrigger } from "@/app/(team)/[team_id]/settings/storage/_components/s3-source-card";
import { sourceAndBucketSeparator } from "@/components/service/helpers";
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
import { ReactNode } from "react";

export type TCreateBackupSourceTriggerProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  children: ReactNode;
  teamId: string;
};

export function CreateBackupSourceTrigger({
  teamId,
  isOpen,
  setIsOpen,
  children,
}: TCreateBackupSourceTriggerProps) {
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent animate={false} className="w-[var(--radix-popper-anchor-width)]">
        <ScrollArea>
          <DropdownMenuLabel className="border-b px-3">
            {"You don't have any buckets. Create a backup source."}
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <NewS3SourceTrigger teamId={teamId}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-1.5">
                <PlusIcon className="-ml-1 size-5" />
                <p className="min-w-0 shrink">Create Backup Source</p>
              </DropdownMenuItem>
            </NewS3SourceTrigger>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
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
