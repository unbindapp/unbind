import { cn } from "@/components/ui/utils";

type TProps = {
  message?: string;
  className?: string;
};

export default function ErrorLine({ className, message }: TProps) {
  const finalMessage = message || "Something went wrong :(";
  return (
    <div
      className={cn(
        "bg-destructive/8 text-destructive flex w-full items-start justify-start rounded-md px-3 py-2 text-sm font-medium",
        className,
      )}
    >
      {finalMessage}
    </div>
  );
}
