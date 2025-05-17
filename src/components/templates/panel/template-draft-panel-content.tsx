import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { TTemplateDraft } from "@/components/templates/template-draft-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { LoaderIcon } from "lucide-react";
import { HTMLAttributes, useMemo } from "react";

type TProps = {
  templateDraft: TTemplateDraft;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

type TInput = {
  name: string;
  value: string;
};

export default function TemplateDraftPanelContent({ templateDraft, className, ...rest }: TProps) {
  const form = useAppForm({
    defaultValues: {
      inputs: templateDraft.template.definition.inputs.map(() => ({
        value: "",
      })) as TInput[],
    },
  });
  return (
    <div
      className={cn(
        "mt-4 flex w-full flex-1 flex-col overflow-hidden border-t select-text sm:mt-6",
        className,
      )}
      {...rest}
    >
      <ScrollArea classNameViewport="pb-8">
        <div className="flex w-full flex-1 flex-col gap-6 px-3 py-4 sm:p-6">
          {/* Inputs */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.validateArrayFieldsStartingFrom("inputs", 0, "submit");
              form.handleSubmit();
            }}
            className="-mx-1 flex w-[calc(100%+0.5rem)] flex-wrap"
          >
            <form.AppField
              name="inputs"
              mode="value"
              children={(field) =>
                field.state.value.map((_, i) => (
                  <div
                    key={`field[${i}]`}
                    className="flex w-full flex-col gap-2 p-1 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex w-full flex-col gap-0.5 px-1">
                      <p className="w-full leading-tight font-semibold">
                        {templateDraft.template.definition.inputs[i].name}
                      </p>
                      <p className="text-muted-foreground w-full">
                        {templateDraft.template.definition.inputs[i].description}
                      </p>
                    </div>
                    <form.Field key={`inputs[${i}].name`} name={`inputs[${i}].value`}>
                      {(subField) => {
                        return (
                          <field.ConditionalInput
                            inputType={templateDraft.template.definition.inputs[i].type}
                            field={subField}
                            value={subField.state.value}
                            onBlur={subField.handleBlur}
                            onChange={(e) => {
                              subField.handleChange(e.target.value);
                            }}
                            placeholder={templateDraft.template.definition.inputs[i].name}
                            autoCapitalize="off"
                            autoCorrect="off"
                            autoComplete="off"
                            spellCheck="false"
                          />
                        );
                      }}
                    </form.Field>
                  </div>
                ))
              }
            />
          </form>
          {/* Services */}
          <div className="flex w-full flex-col gap-2">
            <h3 className="w-full px-1 text-xl leading-tight font-bold">Services</h3>
            <ol className="-mx-1 flex w-[calc(100%+0.5rem)] flex-wrap">
              {templateDraft.template.definition.services.map((service) => (
                <TemplateServiceCard key={service.id} service={service} className="md:w-1/2" />
              ))}
            </ol>
          </div>
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

function TemplateServiceCard({
  service,
  className,
}: {
  service: TTemplateDraft["template"]["definition"]["services"][number];
  className?: string;
}) {
  const descriptionText = useMemo(() => {
    if (service.type === "docker-image") {
      return service.image;
    }
    if (service.type === "database") {
      return `${service.database_type}:${service.database_config?.version || "latest"}`;
    }
    return "Unknown service type";
  }, [service]);
  return (
    <li className={cn("flex w-full p-1", className)}>
      <div className="flex w-full flex-col rounded-xl border px-4 py-3.5">
        <div className="flex w-full items-center justify-start gap-3">
          <BrandIcon brand={service.icon} color="brand" className="size-6 shrink-0" />
          <div className="-mt-0.5 flex min-w-0 flex-1 flex-col justify-start gap-0.5">
            <p className="min-w-0 shrink truncate leading-tight font-semibold">{service.name}</p>
            <p className="text-muted-foreground amin-w-0 shrink truncate text-sm leading-tight">
              {descriptionText}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}
