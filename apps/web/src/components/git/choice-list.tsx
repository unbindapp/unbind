import ErrorCard from "@/components/error-card";
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

// A short list of options picked in place, for dialogs where a dropdown would open behind the dialog
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
    return <ErrorCard className={cn("rounded-lg", className)} message={error} />;
  }
  return (
    <div
      role="radiogroup"
      className={cn("flex max-h-64 w-full flex-col overflow-auto rounded-lg border", className)}
    >
      {!items &&
        placeholderArray.map((i) => (
          <div key={i} className="border-b px-3 py-2.5 last:border-b-0">
            <p className="bg-foreground animate-skeleton w-24 max-w-full rounded-md leading-tight text-transparent">
              Loading
            </p>
          </div>
        ))}
      {items?.map((item) => (
        <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={value === item.value}
          data-checked={value === item.value || undefined}
          onClick={() => onChange(item.value)}
          className="group/choice has-hover:hover:bg-border active:bg-border data-checked:bg-foreground/4-10 focus-visible:ring-primary/50 flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-left outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset"
        >
          <item.Icon className="text-muted-foreground group-data-checked/choice:text-foreground size-4.5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="min-w-0 leading-tight font-medium">{item.label}</p>
            {item.description && (
              <p className="text-muted-foreground min-w-0 text-sm leading-tight">
                {item.description}
              </p>
            )}
          </div>
          <CheckIcon
            strokeWidth={2.5}
            className="size-4.5 shrink-0 opacity-0 group-data-checked/choice:opacity-100"
          />
        </button>
      ))}
    </div>
  );
}
