import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { FilterIcon, SearchIcon, SettingsIcon } from "lucide-react";
import { toast } from "sonner";

type Props = {
  className?: string;
};

export default function TopBar({ className }: Props) {
  return (
    <div className={cn("w-full items-stretch flex gap-2", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Search", {
            description: "This is fake",
            duration: 2000,
            closeButton: false,
          });
        }}
        className="flex-1 flex items-stretch relative"
      >
        <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          className="flex-1 py-2.25 pl-8.5 pr-22"
          placeholder="Search logs..."
        />
        <div className="absolute flex justify-end right-0 top-0 h-full">
          <Button
            aria-label="Filter Logs"
            onClick={() => {
              toast.success("Filter", {
                description: "This is fake",
                duration: 2000,
                closeButton: false,
              });
            }}
            type="button"
            size="icon"
            variant="ghost"
            className="h-auto border-l rounded-none w-10"
          >
            <FilterIcon className="size-5" />
          </Button>
          <Button
            aria-label="Log Settings"
            onClick={() => {
              toast.success("Settings", {
                description: "This is fake",
                duration: 2000,
                closeButton: false,
              });
            }}
            type="button"
            size="icon"
            variant="ghost"
            className="h-auto text-foreground w-10 rounded-l-none rounded-r-lg border-l"
          >
            <SettingsIcon className="size-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
