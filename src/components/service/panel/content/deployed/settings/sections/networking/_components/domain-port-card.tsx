import CopyButton from "@/components/copy-button";
import DeleteButton from "@/components/service/panel/content/deployed/settings/sections/networking/_components/delete-button";
import { getNetworkingDisplayUrl } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/helpers";
import { TModeAndPort } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/types";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { validateDomain } from "@/lib/helpers/validate-domain";
import { validatePort } from "@/lib/helpers/validate-port";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { useStore } from "@tanstack/react-form";
import { GlobeIcon, GlobeLockIcon, PenIcon } from "lucide-react";

export default function DomainPortCard({
  mode,
  domain,
  port,
  service,
}: {
  service: TServiceShallow;
  domain: string;
} & TModeAndPort) {
  /*  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);

  const {
    mutateAsync: updateService,
    isPending: isPendingUpdate,
    error: errorUpdate,
    reset: resetUpdate,
  } = useUpdateService({
    onSuccess: async () => {
      form.reset();
    },
    idToHighlight: sectionHighlightId,
  }); */

  const form = useAppForm({
    defaultValues: {
      host: domain,
      targetPort: port?.toString() || "",
      isEditing: false,
    },
  });

  const changeCount = useStore(form.store, (s) => {
    let count = 0;
    if (!s.fieldMeta.host?.isDefaultValue) count++;
    if (!s.fieldMeta.targetPort?.isDefaultValue) count++;
    return count;
  });

  const deleteButtonExtraProps: TModeAndPort =
    mode === "private" ? { mode: "private", port } : { mode: "public", port };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex w-full flex-col gap-2"
    >
      <form.Subscribe
        selector={(s) => ({
          isEditing: s.values.isEditing,
        })}
        children={({ isEditing }) => (
          <div
            data-editing={isEditing ? true : undefined}
            className="data-editing:border-process/25 group/field flex w-full flex-col overflow-hidden rounded-lg border"
          >
            <>
              <BlockItemButtonLike
                asElement="div"
                classNameText="whitespace-normal"
                className="group-data-editing/field:bg-process/8 group-data-editing/field:text-process border-none group-data-editing/field:rounded-b-none"
                text={getNetworkingDisplayUrl({
                  host: domain,
                  port: mode === "public" ? "" : port.toString(),
                })}
                Icon={({ className }: { className?: string }) =>
                  mode === "private" ? (
                    <GlobeLockIcon className={cn("scale-90", className)} />
                  ) : (
                    <GlobeIcon className={cn("scale-90", className)} />
                  )
                }
                SuffixComponent={({ className }) => (
                  <div
                    className={cn(
                      "-my-2.5 -mr-3 flex items-start justify-end self-stretch p-1",
                      isEditing && "opacity-0",
                      className,
                    )}
                  >
                    <CopyButton
                      disabled={isEditing}
                      className="size-8"
                      classNameIcon="size-4"
                      valueToCopy={getNetworkingDisplayUrl({
                        host: domain,
                        port: mode === "public" ? "" : port.toString(),
                      })}
                    />
                    {mode === "public" && (
                      <Button
                        disabled={isEditing}
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-muted-more-foreground size-8 rounded-md"
                        onClick={() => {
                          form.setFieldValue("isEditing", true);
                        }}
                      >
                        <PenIcon className="size-4" />
                      </Button>
                    )}
                    {service.type !== "database" && (
                      <DeleteButton
                        {...deleteButtonExtraProps}
                        disabled={isEditing}
                        domain={domain}
                        service={service}
                      />
                    )}
                  </div>
                )}
              />
              {isEditing && (
                <div className="border-process/25 flex w-full flex-col border-t">
                  <div className="flex w-full flex-col gap-4 px-3 pt-3 pb-3.25 sm:px-4.5 sm:pt-3.75 sm:pb-4.75">
                    <Block>
                      <form.AppField
                        name="host"
                        validators={{
                          onChange: ({ value }) => validateDomain({ value, isPublic: true }),
                        }}
                      >
                        {(field) => (
                          <BlockItem className="w-full md:w-full">
                            <BlockItemHeader type="column">
                              <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                                Domain
                              </BlockItemTitle>
                            </BlockItemHeader>
                            <BlockItemContent>
                              <field.DomainInput
                                field={field}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => {
                                  field.handleChange(e.target.value);
                                }}
                                placeholder="example.com"
                                autoCapitalize="off"
                                autoCorrect="off"
                                autoComplete="off"
                                spellCheck="false"
                                hideCard={field.state.meta.isDefaultValue}
                              />
                            </BlockItemContent>
                          </BlockItem>
                        )}
                      </form.AppField>
                    </Block>
                    <Block>
                      <form.AppField
                        name="targetPort"
                        validators={{
                          onChange: ({ value }) => validatePort({ value, isPublic: true }),
                        }}
                      >
                        {(field) => (
                          <BlockItem className="w-full md:w-full">
                            <BlockItemHeader type="column">
                              <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                                Target Port
                              </BlockItemTitle>
                            </BlockItemHeader>
                            <BlockItemContent>
                              <field.TextField
                                field={field}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => {
                                  field.handleChange(e.target.value);
                                }}
                                placeholder="3000"
                                autoCapitalize="off"
                                autoCorrect="off"
                                autoComplete="off"
                                spellCheck="false"
                                inputMode="numeric"
                              />
                            </BlockItemContent>
                          </BlockItem>
                        )}
                      </form.AppField>
                    </Block>
                  </div>
                  <div className="bg-process/8 border-process/20 mt-1 flex w-full border-t p-1.5">
                    <div className="w-1/2 p-1.5">
                      <Button
                        variant="outline-process"
                        className="text-foreground has-hover:hover:text-foreground active:text-foreground w-full"
                        onClick={() => {
                          form.reset();
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                    <div className="w-1/2 p-1.5">
                      <Button variant="process" className="w-full">
                        Apply{changeCount > 0 ? ` (${changeCount})` : ""}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          </div>
        )}
      />
    </form>
  );
}
