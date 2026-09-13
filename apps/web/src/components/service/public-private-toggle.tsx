import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

type TProps = {
  isPublic: boolean;
  onChange: (isPublic: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export default function PublicPrivateToggle({ isPublic, onChange, disabled, className }: TProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      onClick={() => onChange(!isPublic)}
      data-private={!isPublic || undefined}
      className={cn(
        "group/button has-hover:hover:bg-border -my-1 -mr-0.5 ml-auto flex cursor-pointer items-center justify-center gap-2.5 rounded-full py-1 pr-1 pl-2.5 font-medium",
        className,
      )}
    >
      <p className="text-muted-foreground group-data-private/button:text-foreground has-hover:group-hover/button:text-foreground min-w-0 shrink">
        Private
      </p>
      <div className="bg-muted-more-foreground group-data-private/button:bg-foreground relative h-5 w-9 rounded-full transition">
        <div className="bg-background absolute top-0.5 left-0.5 size-4 rounded-full transition group-data-private/button:translate-x-4" />
      </div>
    </Button>
  );
}
