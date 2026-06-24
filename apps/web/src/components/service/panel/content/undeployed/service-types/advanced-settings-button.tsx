import { Button } from "@/components/ui/button";
import { ChevronDownIcon, CogIcon } from "lucide-react";

type TProps = {
  onClick: () => void;
  isOpen: boolean;
};

export default function AdvancedSettingsButton({ isOpen, onClick }: TProps) {
  return (
    <Button
      data-open={isOpen || undefined}
      className="group/button text-muted-foreground justify-start gap-2 rounded-md px-3 py-2.75 text-left font-semibold group-data-open/section:rounded-b-none"
      variant="ghost"
      type="button"
      onClick={onClick}
    >
      <CogIcon className="size-5 shrink-0 scale-90 transition group-data-open/button:rotate-90" />
      <p className="min-w-0 shrink">Advanced Settings</p>
      <ChevronDownIcon className="text-muted-foreground -mr-0.75 ml-auto size-5 shrink-0 transition group-data-open/button:rotate-180" />
    </Button>
  );
}
