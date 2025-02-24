import { cn } from "@/components/ui/utils";

type Props = {
  className?: string;
  classNameInner?: string;
};

export default function NavbarSafeAreaInsetBottom({
  className,
  classNameInner,
}: Props) {
  return (
    <div
      className={cn(
        "w-full pointer-events-none pb-[var(--safe-area-inset-bottom)]",
        className
      )}
    >
      <div className={cn("h-24", classNameInner)} />
    </div>
  );
}
