import { ReactNode } from "react";

export function MiniSection({
  title,
  unit,
  hasChanges,
  children,
}: {
  title?: string;
  unit: string;
  hasChanges?: boolean;
  children: ReactNode;
}) {
  return (
    <div data-staged={hasChanges || undefined} className="group/div flex flex-1 flex-col gap-2">
      {title && <p className="px-1.5 leading-tight font-medium">{title}</p>}
      <div className="flex w-full items-start">
        {children}
        <div className="bg-input text-muted-foreground group-data-staged/div:text-change/9-10 group-data-staged/div:bg-change/2-10 group-data-staged/div:border-change/5-10 flex h-10.5 min-w-0 shrink items-center justify-end rounded-r-lg border border-l-0 px-2.5 text-right text-sm leading-tight font-medium">
          <p className="min-w-0 shrink">{unit}</p>
        </div>
      </div>
    </div>
  );
}
