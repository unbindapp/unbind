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
        "w-full h-2px absolute left-0 bottom-0 bg-foreground rounded-full pointer-events-none",
        className
      )}
    />
  );
}
