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

type TProps = {
  items: TChoice[] | undefined;
  isPending?: boolean;
  error?: string;
  className?: string;
} & (
  | { multiple?: false; value: string; onChange: (value: string) => void }
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
);

export default function ChoiceList(props: TProps) {
  const { items, isPending, error, className } = props;
  if (!items && !isPending && error) {
    return <ErrorCard className={className} message={error} />;
  }
  const isSelected = (value: string) =>
    props.multiple ? props.value.includes(value) : props.value === value;
  const select = (value: string) => {
    if (!props.multiple) return props.onChange(value);
    props.onChange(
      props.value.includes(value)
        ? props.value.filter((v) => v !== value)
        : [...props.value, value],
    );
  };
  return (
    <div
      role={props.multiple ? "group" : "radiogroup"}
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
        const selected = isSelected(item.value);
        return (
          <Button
            data-first={index === 0 || undefined}
            data-last={index === items.length - 1 || undefined}
            data-selected={selected || undefined}
            key={item.value}
            type="button"
            role={props.multiple ? "checkbox" : "radio"}
            aria-checked={selected}
            variant="ghost"
            className="group/button w-full justify-start gap-2 rounded-none border-t px-3.5 font-medium data-first:border-t-0"
            onClick={() => select(item.value)}
          >
            <item.Icon className="group-data-selected/button:text-success group-data-selected/button:border-success mt-px -ml-0.5 size-5 self-start" />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
              <p className="max-w-full min-w-0 leading-tight">{item.label}</p>
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
