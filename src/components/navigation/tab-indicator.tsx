import { cn } from "@/components/ui/utils";
import { motion } from "motion/react";

type Props = {
  layoutId: string;
  className?: string;
};

export default function TabIndicator({ layoutId, className }: Props) {
  return (
    <motion.div
      layoutId={layoutId}
      transition={{ duration: 0.15 }}
      className={cn(
        "h-2px bg-foreground pointer-events-none absolute bottom-0 left-0 w-full rounded-full",
        className,
      )}
    />
  );
}
