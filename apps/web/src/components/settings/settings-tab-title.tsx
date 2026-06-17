import { cn } from "@/components/ui/utils";

type TProps = {
  className?: string;
  children: string;
};

export default function SettingsTabTitle({ className, children }: TProps) {
  return (
    <h2 className={cn("w-full px-1 text-xl leading-tight font-bold", className)}>{children}</h2>
  );
}
