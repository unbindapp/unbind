import { cn } from "@/components/ui/utils";

type TProps = {
  className?: string;
  children: React.ReactNode;
};

export default function PanelHeaderButtonsWrapper({ className, children }: TProps) {
  return (
    <div
      className={cn(
        "-mt-3.25 -mr-4 flex items-center justify-end gap-1 sm:-mt-3 sm:-mr-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
