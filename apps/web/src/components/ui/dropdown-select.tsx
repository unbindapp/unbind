import ErrorCard from "@/components/error-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { CheckIcon } from "lucide-react";
import { FC, ReactNode, useRef, useState } from "react";

export type TDropdownSelectItem = {
  value: string;
  label: string;
};

const placeholderArray = Array.from({ length: 4 }, (_, index) => index);

type TDropdownSelectProps = {
  items: TDropdownSelectItem[] | undefined;
  value: string;
  onChange: (value: string) => void;
  children: ({ isOpen }: { isOpen: boolean }) => ReactNode;
  ItemIcon?: FC<{ className?: string; value: string }>;
  ItemSuffix?: FC<{ className?: string; value: string }>;
  isPending?: boolean;
  error?: string;
  title?: string;
  align?: Parameters<typeof DropdownMenuContent>["0"]["align"];
  className?: string;
  classNameContent?: string;
  classNameItem?: string | (({ value }: { value: string }) => string);
};

export default function DropdownSelect({
  items,
  value,
  onChange,
  children,
  ItemIcon,
  ItemSuffix,
  isPending,
  error,
  title,
  align,
  className,
  classNameContent,
  classNameItem,
}: TDropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild className={className}>
        {children({ isOpen })}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        animate={false}
        className={cn("w-(--radix-popper-anchor-width)", classNameContent)}
        align={align}
      >
        <ScrollArea viewportRef={scrollAreaRef}>
          {title && (
            <>
              <DropdownMenuLabel>{title}</DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuGroup>
            {!items && !isPending && error && <ErrorCard className="rounded-md" message={error} />}
            {!items &&
              isPending &&
              placeholderArray.map((_, index) => (
                <DropdownMenuItem disabled key={index}>
                  <p className="bg-foreground animate-skeleton min-w-0 shrink rounded-md leading-tight">
                    Loading
                  </p>
                </DropdownMenuItem>
              ))}
            {items &&
              items.map((item) => (
                <DropdownMenuItem
                  key={item.value}
                  onSelect={() => {
                    onChange(item.value);
                    setIsOpen(false);
                  }}
                  data-checked={value === item.value || undefined}
                  className={cn(
                    "group/item",
                    typeof classNameItem === "function"
                      ? classNameItem({ value: item.value })
                      : classNameItem,
                  )}
                >
                  {ItemIcon && <ItemIcon className="-ml-0.5 size-5 shrink-0" value={item.value} />}
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5 pr-1">
                    <p className="min-w-0 shrink leading-tight">{item.label}</p>
                    {ItemSuffix && <ItemSuffix value={item.value} />}
                  </div>
                  <CheckIcon
                    strokeWidth={2.5}
                    className="-mr-0.5 ml-auto size-4.5 opacity-0 group-data-checked/item:opacity-100"
                  />
                </DropdownMenuItem>
              ))}
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
