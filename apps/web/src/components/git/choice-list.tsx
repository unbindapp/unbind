import ErrorCard from "@/components/error-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { CheckIcon } from "lucide-react";
import { FC } from "react";

export type TChoice = {
  value: string;
  label: string;
  description?: string;
  Icon: FC<{ className?: string }>;
};

const placeholderArray = Array.from({ length: 2 }, (_, i) => i);

export default function ChoiceList({
  items,
  value,
  onChange,
  isPending,
  error,
  className,
}: {
  items: TChoice[] | undefined;
  value: string;
  onChange: (value: string) => void;
  isPending?: boolean;
  error?: string;
  className?: string;
}) {
  if (!items && !isPending && error) {
    return <ErrorCard className={className} message={error} />;
  }
  return (
    <div role="radiogroup" className={cn("flex w-full flex-col", className)}>
      {!items &&
        placeholderArray.map((i) => (
          <Button key={i} disabled fadeOnDisabled={false} variant="ghost" className="justify-start">
            <p className="bg-muted-foreground animate-skeleton rounded-md text-transparent">
              Loading option
            </p>
          </Button>
        ))}
      {items?.map((item) => {
        const isSelected = value === item.value;
        return (
          <Button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            variant={isSelected ? "ghost-success" : "ghost"}
            className={cn("w-full justify-start px-3", !isSelected && "text-muted-foreground")}
            onClick={() => onChange(item.value)}
          >
            <item.Icon className="-ml-0.5 size-5" />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
              <p className="min-w-0 leading-tight">{item.label}</p>
              {item.description && (
                <p className="min-w-0 text-sm leading-tight font-medium">{item.description}</p>
              )}
            </div>
            <CheckIcon
              strokeWidth={2.5}
              className={cn("-mr-0.5 size-4.5", !isSelected && "opacity-0")}
            />
          </Button>
        );
      })}
    </div>
  );
}
