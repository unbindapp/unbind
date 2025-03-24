"use client";

import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/lib/hooks/use-copy";
import { AppRouterOutputs } from "@/server/trpc/api/root";
import { CheckIcon, CopyIcon, EllipsisVerticalIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";

type TProps =
  | {
      variable: AppRouterOutputs["variables"]["list"]["variables"][number];
      isPlaceholder?: never;
    }
  | {
      isPlaceholder: true;
      variable?: never;
    };

export default function VariableCard({ variable, isPlaceholder }: TProps) {
  const [isValueVisible, setIsValueVisible] = useState(false);
  const { copyToClipboard, isRecentlyCopied } = useCopyToClipboard();

  return (
    <div
      data-placeholder={isPlaceholder ? true : undefined}
      data-value-visible={isValueVisible ? true : undefined}
      className="has-hover:hover:bg-background-hover group/card relative flex w-full flex-col rounded-xl border px-3 py-0.75 font-mono data-placeholder:text-transparent sm:flex-row sm:items-center sm:rounded-lg"
    >
      <div className="flex w-full shrink-0 py-2 pr-8 sm:w-56 sm:pr-4">
        <p className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton min-w-0 shrink overflow-hidden text-sm leading-none text-ellipsis whitespace-nowrap group-data-placeholder/card:rounded-sm group-data-placeholder/card:text-transparent">
          {isPlaceholder ? "Loading key" : variable.name}
        </p>
      </div>
      <div className="flex w-full min-w-0 flex-1 items-center sm:mt-0 sm:w-auto">
        <Button
          data-copied={isRecentlyCopied ? true : undefined}
          onClick={isPlaceholder ? () => null : () => copyToClipboard(variable.value)}
          variant="ghost"
          forceMinSize="medium"
          size="icon"
          className="text-muted-more-foreground group/button -ml-2 rounded-md group-data-placeholder/card:text-transparent"
          disabled={isPlaceholder}
          fadeOnDisabled={false}
        >
          <div className="relative size-4 transition-transform group-data-copied/button:rotate-90">
            <CopyIcon className="group-data-copied/button:text-success size-full transition-opacity group-data-copied/button:opacity-0" />
            <CheckIcon
              strokeWidth={3}
              className="group-data-copied/button:text-success absolute top-0 left-0 size-full -rotate-90 opacity-0 transition-opacity group-data-copied/button:opacity-100"
            />
            {isPlaceholder && (
              <div className="bg-muted-more-foreground animate-skeleton absolute top-0 left-0 size-full rounded-sm" />
            )}
          </div>
        </Button>
        <Button
          data-visible={isValueVisible ? true : undefined}
          onClick={() => setIsValueVisible((prev) => !prev)}
          variant="ghost"
          forceMinSize="medium"
          size="icon"
          className="text-muted-more-foreground group/button rounded-md group-data-placeholder/card:text-transparent"
          disabled={isPlaceholder}
          fadeOnDisabled={false}
        >
          <div className="relative size-4">
            <EyeIcon className="size-full group-data-visible/button:opacity-0" />
            <EyeOffIcon className="absolute top-0 left-0 size-full opacity-0 group-data-visible/button:opacity-100" />
            {isPlaceholder && (
              <div className="bg-muted-more-foreground animate-skeleton absolute top-0 left-0 size-full rounded-sm" />
            )}
          </div>
        </Button>
        <div className="flex min-w-0 shrink py-1 pl-2">
          <p className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton min-w-0 shrink overflow-hidden text-xs leading-none text-ellipsis whitespace-nowrap group-data-placeholder/card:rounded-sm group-data-placeholder/card:text-transparent">
            {isPlaceholder || !isValueVisible ? "••••••••••" : variable.value}
          </p>
        </div>
        <div className="absolute top-1 right-1 ml-auto pl-1 sm:relative sm:top-auto sm:right-auto sm:-mr-2.25">
          <Button
            disabled={isPlaceholder}
            fadeOnDisabled={false}
            variant="ghost"
            size="icon"
            className="text-muted-more-foreground rounded-md group-data-placeholder/card:text-transparent"
          >
            {isPlaceholder ? (
              <div className="group-data-placeholder/card:bg-muted-foreground group-data-placeholder/card:animate-skeleton size-6 group-data-placeholder/card:rounded-md" />
            ) : (
              <EllipsisVerticalIcon className="size-6" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
