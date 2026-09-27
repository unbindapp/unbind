import { Button } from "@/components/ui/button";
import { LoaderIcon, RotateCcwIcon, SaveIcon } from "lucide-react";
import { ReactNode } from "react";

export function FormActions({
  isSubmitting,
  isUnchanged,
  onUndo,
}: {
  isSubmitting: boolean;
  isUnchanged: boolean;
  onUndo: () => void;
}) {
  return (
    <div className="flex w-full flex-row gap-3 md:w-auto">
      <Button
        type="submit"
        data-submitting={isSubmitting || undefined}
        className="group/button flex-1 md:flex-none xl:py-3.5"
        disabled={isUnchanged}
      >
        <div className="-ml-0.5 size-4.5 shrink-0">
          {isSubmitting ? (
            <LoaderIcon className="size-full animate-spin" />
          ) : (
            <SaveIcon className="size-full" />
          )}
        </div>
        <p className="min-w-0 shrink">Save</p>
      </Button>
      <Button
        type="button"
        disabled={isUnchanged}
        onClick={onUndo}
        variant="outline"
        className="gap-1.5 xl:py-3.5"
      >
        <RotateCcwIcon
          data-unchanged={isUnchanged || undefined}
          className="-ml-0.5 size-4.5 shrink-0 transition-transform data-unchanged:-rotate-90"
        />
        <p className="min-w-0">Undo</p>
      </Button>
    </div>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex w-full flex-col gap-1 px-1">
        <h3 className="leading-tight font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function SectionSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3 text-transparent">
      <div className="flex w-full flex-col gap-1 px-1">
        <p className="bg-foreground animate-skeleton max-w-full self-start rounded-md leading-tight font-semibold">
          Loading section
        </p>
        <p className="bg-muted-foreground animate-skeleton max-w-full self-start rounded-md text-sm">
          Loading the description of this section
        </p>
      </div>
      <div className="bg-muted-foreground animate-skeleton h-10.5 w-full rounded-lg" />
    </div>
  );
}
