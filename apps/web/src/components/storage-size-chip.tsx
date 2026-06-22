import { cn } from "@/components/ui/utils";

export default function StorageSizeChip({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "text-foreground bg-foreground/6 border-foreground/6 rounded-md border px-1.25 font-mono",
        className,
      )}
    >
      {children}
    </span>
  );
}
