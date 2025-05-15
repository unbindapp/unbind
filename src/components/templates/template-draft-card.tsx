import TemplateDraftPanel from "@/components/templates/panel/template-draft-panel";
import TemplateDraftIcon from "@/components/templates/template-draft-icon";
import { TTemplateDraft } from "@/components/templates/template-draft-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

type TProps = {
  templateDraft: TTemplateDraft;
  className?: string;
  classNameCard?: string;
};

export default function TemplateDraftCard({ templateDraft, className, classNameCard }: TProps) {
  return (
    <li className={cn("group/item flex w-full flex-col p-1", className)}>
      <TemplateDraftPanel templateDraft={templateDraft}>
        <Button
          variant="ghost"
          className={cn(
            "bg-process/8 has-hover:hover:bg-process/16 active:bg-process/16 border-process/16 flex min-h-36 w-full flex-col items-start gap-12 rounded-xl border border-dashed px-5 py-3.5 text-left",
            classNameCard,
          )}
        >
          <div className="flex w-full items-center justify-start gap-2">
            <TemplateDraftIcon templateDraft={templateDraft} className="-ml-1 size-6" />
            <h3 className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink overflow-hidden leading-tight font-bold text-ellipsis whitespace-nowrap group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
              {templateDraft.name}
            </h3>
          </div>
          <div className="flex w-full flex-1 flex-col justify-end">
            <p className="text-muted-foreground flex w-full min-w-0 shrink items-center justify-between overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap">
              {templateDraft.template.definition.services.length}{" "}
              {`service${templateDraft.template.definition.services.length >= 2 ? "s" : ""}`}
            </p>
          </div>
        </Button>
      </TemplateDraftPanel>
    </li>
  );
}
