import BrandIcon from "@/components/icons/brand";
import TemplateDraftPanel from "@/components/templates/panel/template-draft-panel";
import TemplateDraftIcon from "@/components/templates/template-draft-icon";
import { TTemplateDraft } from "@/components/templates/template-draft-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { HTMLProps, useMemo } from "react";

type TProps = {
  templateDraft: TTemplateDraft;
  className?: string;
  classNameCard?: string;
} & HTMLProps<HTMLLIElement>;

const iconLength = 4;

export default function TemplateDraftCard({
  templateDraft,
  className,
  classNameCard,
  ...rest
}: TProps) {
  const serviceCount = templateDraft.template.definition.services.length;
  const serviceIcons = useMemo(
    () => [...new Set(templateDraft.template.definition.services.map((s) => s.icon))],
    [templateDraft.template.definition.services],
  );

  return (
    <li {...rest} className={cn("group/item flex w-full flex-col p-1", className)}>
      <TemplateDraftPanel templateDraft={templateDraft}>
        <Button
          variant="ghost"
          className={cn(
            "bg-process/8 dark:bg-process/6 dark:has-hover:hover:bg-process/12 dark:active:bg-process/12 has-hover:hover:bg-process/16 active:bg-process/16 dark:border-process/20 border-process/24 flex min-h-36 w-full flex-col items-start gap-12 rounded-xl border border-dashed bg-[radial-gradient(color-mix(in_oklab,var(--process)_8%,transparent)_1px,transparent_1px),radial-gradient(color-mix(in_oklab,var(--process)_8%,transparent)_1px,transparent_1px)] [background-size:10px_10px] [background-position:0px_0px,5px_5px] px-5 py-3.5 text-left font-semibold dark:bg-[radial-gradient(color-mix(in_oklab,var(--process)_6%,transparent)_1px,transparent_1px),radial-gradient(color-mix(in_oklab,var(--process)_6%,transparent)_1px,transparent_1px)]",
            classNameCard,
          )}
        >
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex min-w-0 shrink items-center justify-start gap-2">
              <TemplateDraftIcon templateDraft={templateDraft} className="-ml-1 size-6" />
              <h3 className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink overflow-hidden leading-tight text-ellipsis whitespace-nowrap group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
                {templateDraft.name}
              </h3>
            </div>
            <div className="bg-background -mr-1.5 max-w-1/2 shrink-0 rounded-sm">
              <p className="text-process dark:bg-process/12 dark:border-process/16 bg-process/14 border-process/18 truncate rounded-sm border px-1.5 py-0.5 text-xs font-medium">
                Template
              </p>
            </div>
          </div>
          <div className="flex w-full flex-1 flex-col justify-end">
            <div className="text-muted-foreground flex w-full items-end justify-between gap-6">
              <div className="py-0.375 flex min-w-0 shrink flex-col gap-0.75 text-sm font-medium">
                <p className="group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink truncate leading-tight group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
                  {serviceCount !== undefined && serviceCount > 0
                    ? `${serviceCount} service${serviceCount > 1 ? "s" : ""}`
                    : "No services"}
                </p>
              </div>
              {serviceIcons !== undefined && serviceIcons.length > 0 && (
                <div className="-mr-1 flex max-w-2/3 shrink-0 items-center gap-1 overflow-hidden">
                  {serviceIcons.slice(0, iconLength).map((s, index) => (
                    <BrandIcon
                      brand={s}
                      className="group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton size-5 group-data-placeholder/item:rounded-full group-data-placeholder/item:text-transparent"
                      key={`${s}-${index}`}
                    />
                  ))}
                  {serviceIcons.length > iconLength && (
                    <p className="flex h-5 min-w-5 items-center justify-center overflow-hidden rounded-full text-center text-sm font-semibold">
                      +{serviceIcons.length - iconLength}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Button>
      </TemplateDraftPanel>
    </li>
  );
}
