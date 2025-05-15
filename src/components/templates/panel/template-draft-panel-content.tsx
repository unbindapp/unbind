import ErrorLine from "@/components/error-line";
import { TTemplateDraft } from "@/components/templates/template-draft-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { LoaderIcon } from "lucide-react";
import { HTMLAttributes } from "react";

type TProps = {
  templateDraft: TTemplateDraft;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

export default function TemplateDraftPanelContent({ templateDraft, className, ...rest }: TProps) {
  return (
    <div
      className={cn("mt-4 flex w-full flex-1 flex-col overflow-hidden border-t sm:mt-6", className)}
      {...rest}
    >
      <ScrollArea classNameViewport="pb-8">
        <div className="flex w-full flex-1 flex-col gap-6 px-3 py-4 sm:p-6">
          {templateDraft.template.definition.services.map((service) => (
            <p key={service.id} className="w-full">
              {service.name}
            </p>
          ))}
        </div>
      </ScrollArea>
      <div className="flex w-full flex-col gap-2 border-t px-3 pt-3 pb-[calc(var(--safe-area-inset-bottom)+0.75rem)] sm:px-6 sm:pt-6 sm:pb-[calc(var(--safe-area-inset-bottom)+1.5rem)]">
        {false && <ErrorLine />}
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <Button
            data-pending={undefined}
            className="group/button data-pending:bg-foreground/60 w-full"
            disabled={false}
            fadeOnDisabled={false}
          >
            {false && (
              <div className="absolute top-0 left-0 h-full w-full items-center justify-center overflow-hidden rounded-lg">
                <div className="from-foreground/0 via-foreground to-foreground/0 animate-ping-pong absolute top-1/2 left-1/2 aspect-square w-full origin-center -translate-1/2 bg-gradient-to-r" />
              </div>
            )}
            <div className="relative flex w-full items-center justify-center gap-1.5">
              {false && <LoaderIcon className="-my-1 -ml-0.5 size-5 shrink-0 animate-spin" />}
              <p className="min-w-0 shrink">{false ? "Deploying" : "Deploy"}</p>
            </div>
          </Button>
        </form>
      </div>
    </div>
  );
}
