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

type Props = {
  variable: TVariable;
};

export default function VariableLine({ variable }: Props) {
  const [isValueVisible, setIsValueVisible] = useState(false);
  const { copyToClipboard, isRecentlyCopied } = useCopyToClipboard();

  return (
    <div
      data-value-visible={isValueVisible ? true : undefined}
      className="w-full select-text flex flex-col sm:flex-row sm:items-center font-mono px-3 py-0.75 not-touch:hover:bg-background-hover 
      border rounded-xl sm:rounded-lg group/line relative"
    >
      <p className="w-full leading-none text-sm shrink-0 py-2 pr-8 sm:pr-4 sm:w-56 whitespace-nowrap overflow-hidden overflow-ellipsis">
        {variable.key}
      </p>
      <div className="w-full sm:mt-0 sm:w-auto flex-1 min-w-0 flex items-center">
        <Button
          data-copied={isRecentlyCopied ? true : undefined}
          onClick={() => copyToClipboard(variable.value)}
          variant="foreground-ghost"
          forceMinSize="medium"
          size="icon"
          className="rounded-md text-muted-more-foreground group/button -ml-2"
        >
          <div className="size-4 relative group-data-[copied]/button:rotate-45 transition-transform">
            <CopyIcon className="size-4 group-data-[copied]/button:opacity-0" />
            <CheckIcon className="size-4 absolute left-0 top-0 text-success -rotate-45 opacity-0 group-data-[copied]/button:opacity-100" />
          </div>
        </Button>
        <Button
          onClick={() => setIsValueVisible((prev) => !prev)}
          variant="foreground-ghost"
          forceMinSize="medium"
          size="icon"
          className="rounded-md text-muted-more-foreground"
        >
          {isValueVisible ? (
            <EyeOffIcon className="size-4" />
          ) : (
            <EyeIcon className="size-4" />
          )}
        </Button>
        <p className="leading-none shrink min-w-0 whitespace-nowrap overflow-hidden overflow-ellipsis py-1 pl-2 text-xs">
          {isValueVisible ? variable.value : "••••••••"}
        </p>
        <div className="ml-auto pl-1 sm:-mr-2.25 absolute right-1 top-1 sm:relative sm:top-auto sm:right-auto">
          <Button
            variant="foreground-ghost"
            size="icon"
            className="rounded-md text-muted-more-foreground"
          >
            <EllipsisVerticalIcon className="size-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
