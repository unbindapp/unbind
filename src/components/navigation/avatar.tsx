import Blockies from "@/components/blockies/blockies";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

type Props = { className?: string };

export default function Avatar({ className }: Props) {
  return (
    <Button
      size="icon"
      className={cn(
        "size-6.5 rounded-full border border-foreground group/button",
        className
      )}
      variant="ghost"
    >
      <Blockies
        address="yekta"
        className="size-full rounded-full transition group-hover/button:rotate-30 group-active/button:rotate-30"
      />
    </Button>
  );
}
