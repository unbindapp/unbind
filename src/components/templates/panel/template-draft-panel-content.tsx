import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { TTemplateDraft, TTemplateInput } from "@/components/templates/template-draft-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  ArchiveIcon,
  DatabaseIcon,
  GlobeIcon,
  LoaderIcon,
  TextCursorInputIcon,
} from "lucide-react";
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
  const visibleInputs = useMemo(
    () => templateDraft.template.definition.inputs.filter((i) => !i.hidden),
    [templateDraft.template.definition.inputs],
  );

  const form = useAppForm({
    defaultValues: {
      inputs: visibleInputs.map(() => ({
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
          <div className="-m-1 flex w-[calc(100%+0.5rem)] flex-col">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.validateArrayFieldsStartingFrom("inputs", 0, "submit");
                form.handleSubmit();
              }}
              className="-my-3 flex w-full flex-col"
            >
              <form.AppField
                name="inputs"
                mode="value"
                children={(field) =>
                  field.state.value.map((_, i) => (
                    <div
                      key={`field[${i}]`}
                      className="flex w-full flex-col gap-2 p-1 py-3 md:w-1/2"
                    >
                      <div className="flex w-full flex-col gap-0.5 px-1">
                        <div className="flex w-full items-start gap-1.5">
                          <TemplateInputIcon input={visibleInputs[i]} />
                          <p className="-mt-0.5 min-w-0 shrink leading-tight font-semibold">
                            {visibleInputs[i].name}
                          </p>
                        </div>
                        <p className="text-muted-foreground w-full text-sm">
                          {visibleInputs[i].description}
                        </p>
                      </div>
                      <form.Field key={`inputs[${i}].name`} name={`inputs[${i}].value`}>
                        {(subField) => {
                          const input = visibleInputs[i];
                          if (input.type === "database-size" || input.type === "volume-size") {
                            return (
                              <field.StorageSizeInput
                                field={subField}
                                className="w-full py-1.5"
                                onBlur={subField.handleBlur}
                                min={1}
                                step={1}
                                max={100}
                                value={[Number(subField.state.value ?? 1)]}
                                onValueChange={(value) => {
                                  subField.handleChange(String(value[0]));
                                }}
                              />
                            );
                          }
                          return (
                            <field.DomainInput
                              field={subField}
                              value={subField.state.value}
                              onBlur={subField.handleBlur}
                              onChange={(e) => {
                                subField.handleChange(e.target.value);
                              }}
                              placeholder={input.name}
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
          </div>
          {/* Services */}
          <div className="flex w-full flex-col gap-2 pt-1">
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

function TemplateInputIcon({ input, className }: { input: TTemplateInput; className?: string }) {
  const classNameDefault = "size-4 shrink-0";
  if (input.type === "database-size") {
    return <DatabaseIcon className={cn(classNameDefault, className)} />;
  }
  if (input.type === "volume-size") {
    return <ArchiveIcon className={cn(classNameDefault, className)} />;
  }
  if (input.type === "host") {
    return <GlobeIcon className={cn(classNameDefault, className)} />;
  }
  return <TextCursorInputIcon className={cn(classNameDefault, className)} />;
}
