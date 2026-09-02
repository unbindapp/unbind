import BrandIcon from "@/components/icons/brand";
import { TPendingService } from "@/components/stores/pending/pending-entity-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { LoaderIcon } from "lucide-react";

type TProps = {
  pendingService: TPendingService;
  className?: string;
};

export default function PendingServiceCard({ pendingService, className }: TProps) {
  return (
    <li
      className={cn(
        "group/item animate-skeleton-smooth pointer-events-none flex min-h-40 w-full flex-col p-1 opacity-(--skeleton-smooth-opacity)",
        className,
      )}
    >
      <Button
        variant="card"
        disabled
        fadeOnDisabled={false}
        className="flex w-full flex-1 flex-col items-start gap-6 rounded-xl border px-5 py-3.5 text-left font-semibold"
      >
        <div className="flex w-full items-center justify-start gap-2">
          <BrandIcon color="brand" brand={pendingService.icon} className="-ml-1 size-5" />
          <h3 className="min-w-0 shrink overflow-hidden leading-tight text-ellipsis whitespace-nowrap">
            {pendingService.name}
          </h3>
        </div>
        <div className="flex w-full flex-1 flex-col justify-end">
          <div className="text-muted-foreground -mx-0.5 flex w-[calc(100%+0.25rem)] items-center gap-1.75 text-sm font-normal">
            <LoaderIcon className="size-3.5 shrink-0 animate-spin" />
            <p className="min-w-0 shrink truncate">Creating</p>
          </div>
        </div>
      </Button>
    </li>
  );
}
