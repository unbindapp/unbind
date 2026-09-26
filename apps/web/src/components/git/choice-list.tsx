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
    <div
      role="radiogroup"
      className={cn("flex w-full flex-col overflow-hidden rounded-xl border", className)}
    >
      {!items &&
        placeholderArray.map((i, index) => (
          <Button
            key={i}
            data-first={index === 0 || undefined}
            disabled
            fadeOnDisabled={false}
            variant="ghost"
            className="group/button w-full justify-start gap-2 rounded-none border-t px-3.5 font-medium data-first:border-t-0"
          >
            <p className="bg-muted-foreground animate-skeleton rounded-md text-transparent">
              Loading option
            </p>
          </Button>
        ))}
      {items?.map((item, index) => {
        const isSelected = value === item.value;
        return (
          <Button
            data-first={index === 0 || undefined}
            data-last={index === items.length - 1 || undefined}
            data-selected={isSelected || undefined}
            key={item.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            variant="ghost"
            className="group/button w-full justify-start gap-2 rounded-none border-t px-3.5 font-medium data-first:border-t-0"
            onClick={() => onChange(item.value)}
          >
            <item.Icon className="group-data-selected/button:text-success mt-px -ml-0.5 size-5 self-start" />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
              <p className="group-data-selected/button:text-success max-w-full min-w-0 leading-tight">
                {item.label}
              </p>
              {item.description && (
                <p className="text-muted-foreground max-w-full min-w-0 text-sm leading-tight font-normal">
                  {item.description}
                </p>
              )}
            </div>
            <CheckIcon
              strokeWidth={2.5}
              className="group-data-selected/button:text-success mt-px -mr-0.5 size-4.5 self-start text-transparent"
            />
          </Button>
        );
      })}
    </div>
  );
}
