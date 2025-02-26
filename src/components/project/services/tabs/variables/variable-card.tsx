"use client";

import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/lib/hooks/use-copy";
import { TVariable } from "@/server/trpc/api/main/router";
import {
  CheckIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react";
import { useState } from "react";

type Props =
  | {
      variable: TVariable;
      isPlaceholder?: never;
    }
  | {
      isPlaceholder: true;
      variable?: never;
    };

export default function VariableCard({ variable, isPlaceholder }: Props) {
  const [isValueVisible, setIsValueVisible] = useState(false);
  const { copyToClipboard, isRecentlyCopied } = useCopyToClipboard();

  return (
    <div
      data-placeholder={isPlaceholder ? true : undefined}
      data-value-visible={isValueVisible ? true : undefined}
      className="w-full select-text flex flex-col sm:flex-row sm:items-center font-mono px-3 py-0.75 has-hover:hover:bg-background-hover 
      border rounded-xl sm:rounded-lg group/card relative data-[placeholder]:text-transparent"
    >
      <div className="w-full py-2 pr-8 sm:pr-4 sm:w-56 flex shrink-0">
        <p
          className="shrink min-w-0 text-sm leading-none whitespace-nowrap overflow-hidden overflow-ellipsis
          group-data-[placeholder]/card:text-transparent group-data-[placeholder]/card:rounded-sm group-data-[placeholder]/card:bg-foreground group-data-[placeholder]/card:animate-skeleton"
        >
          {isPlaceholder ? "Loading key" : variable.key}
        </p>
      </div>
      <div className="w-full sm:mt-0 sm:w-auto flex-1 min-w-0 flex items-center">
        <Button
          data-copied={isRecentlyCopied ? true : undefined}
          onClick={
            isPlaceholder ? () => null : () => copyToClipboard(variable.value)
          }
          variant="ghost"
          forceMinSize="medium"
          size="icon"
          className="rounded-md text-muted-more-foreground group/button -ml-2 group-data-[placeholder]/card:text-transparent"
          disabled={isPlaceholder}
          fadeOnDisabled={false}
        >
          <div className="size-4 relative group-data-[copied]/button:rotate-90 transition-transform">
            <CopyIcon className="size-full group-data-[copied]/button:opacity-0 group-data-[copied]/button:text-success transition-opacity" />
            <CheckIcon
              strokeWidth={3}
              className="size-full absolute left-0 top-0 group-data-[copied]/button:text-success -rotate-90 opacity-0 group-data-[copied]/button:opacity-100 transition-opacity"
            />
            {isPlaceholder && (
              <div className="size-full rounded-sm bg-muted-more-foreground animate-skeleton absolute  left-0 top-0" />
            )}
          </div>
        </Button>
        <Button
          data-visible={isValueVisible ? true : undefined}
          onClick={() => setIsValueVisible((prev) => !prev)}
          variant="ghost"
          forceMinSize="medium"
          size="icon"
          className="rounded-md text-muted-more-foreground group/button group-data-[placeholder]/card:text-transparent"
          disabled={isPlaceholder}
          fadeOnDisabled={false}
        >
          <div className="size-4 relative">
            <EyeIcon className="size-4 group-data-[visible]/button:opacity-0" />
            <EyeOffIcon className="size-4 absolute left-0 top-0 opacity-0 group-data-[visible]/button:opacity-100" />
            {isPlaceholder && (
              <div className="size-full rounded-sm bg-muted-more-foreground animate-skeleton absolute left-0 top-0" />
            )}
          </div>
        </Button>
        <div className="flex shrink min-w-0 py-1 pl-2">
          <p
            className="leading-none shrink min-w-0 whitespace-nowrap overflow-hidden overflow-ellipsis text-xs 
            group-data-[placeholder]/card:text-transparent group-data-[placeholder]/card:rounded-sm group-data-[placeholder]/card:bg-foreground group-data-[placeholder]/card:animate-skeleton"
          >
            {isPlaceholder || !isValueVisible ? "••••••••••" : variable.value}
          </p>
        </div>
        <div className="ml-auto pl-1 sm:-mr-2.25 absolute right-1 top-1 sm:relative sm:top-auto sm:right-auto">
          <Button
            disabled={isPlaceholder}
            fadeOnDisabled={false}
            variant="ghost"
            size="icon"
            className="rounded-md text-muted-more-foreground group-data-[placeholder]/card:text-transparent"
          >
            {isPlaceholder ? (
              <div className="size-5 group-data-[placeholder]/card:rounded-md group-data-[placeholder]/card:bg-muted-foreground group-data-[placeholder]/card:animate-skeleton" />
            ) : (
              <EllipsisVerticalIcon className="size-6" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
