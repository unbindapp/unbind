"use client";

import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/lib/hooks/use-copy";
import { TVariable } from "@/server/trpc/api/main/router";
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from "lucide-react";
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
      className="w-full select-text flex items-center font-mono px-3 py-0.75 hover:bg-background-hover 
      border rounded-lg group/line"
    >
      <p className="leading-none text-sm shrink-0 py-2 pr-4 w-48 sm:w-64 whitespace-nowrap overflow-hidden overflow-ellipsis">
        {variable.key}
      </p>
      <Button
        onClick={() => setIsValueVisible((prev) => !prev)}
        variant="foreground-ghost"
        size="icon"
        className="rounded-lg text-muted-more-foreground"
      >
        {isValueVisible ? (
          <EyeOffIcon className="size-4" />
        ) : (
          <EyeIcon className="size-4" />
        )}
      </Button>
      <Button
        data-copied={isRecentlyCopied ? true : undefined}
        disabled={isRecentlyCopied}
        fadeOnDisabled={false}
        onClick={() => copyToClipboard(variable.value)}
        variant="foreground-ghost"
        size="icon"
        className="rounded-lg text-muted-more-foreground group/button"
      >
        <div className="size-4 relative group-data-[copied]/button:rotate-30 transition-transform">
          <CopyIcon className="size-4 group-data-[copied]/button:opacity-0" />
          <CheckIcon className="size-4 absolute left-0 top-0 text-success -rotate-30 opacity-0 group-data-[copied]/button:opacity-100" />
        </div>
      </Button>
      <p className="leading-none shrink min-w-0 whitespace-nowrap overflow-hidden overflow-ellipsis py-1 pl-2 text-xs">
        {isValueVisible ? variable.value : "••••••••"}
      </p>
    </div>
  );
}
