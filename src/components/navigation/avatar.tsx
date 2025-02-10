import Blockies from "@/components/blockies/blockies";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

type Props = { className?: string };

export default function Avatar({ className }: Props) {
  return (
    <Button
      size="icon"
      className={cn(
        "size-6.5 rounded-full border border-foreground shrink-0 group/button",
        className
      )}
      variant="ghost"
    >
      <Blockies
        address="yekta"
        className="size-full shrink-0 rounded-full transition group-hover/button:rotate-30 group-active/button:rotate-30"
      />
    </Button>
  );
}
