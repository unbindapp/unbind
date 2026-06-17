import { cn } from "@/components/ui/utils";
import { motion } from "motion/react";

type TProps = {
  layoutId: string;
  className?: string;
};

export default function TabIndicator({ layoutId, className }: TProps) {
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
