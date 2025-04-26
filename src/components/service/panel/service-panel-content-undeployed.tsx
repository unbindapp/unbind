import ErrorCard from "@/components/error-card";
import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { useServicesUtils } from "@/components/project/services-provider";
import { useDeployments } from "@/components/service/deployments-provider";
import { useService } from "@/components/service/service-provider";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import CreateVariablesForm, {
  CreateVariablesFormSchema,
  TCreateVariablesForm,
} from "@/components/variables/create-variables-form";
import VariableReferencesProvider from "@/components/variables/variable-references-provider";
import VariablesProvider from "@/components/variables/variables-provider";
import { defaultDebounceMs } from "@/lib/constants";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { TVariableForCreate, VariableForCreateSchema } from "@/server/trpc/api/variables/types";
import { api } from "@/server/trpc/setup/client";
import { CommandEmpty } from "cmdk";
import { ChevronDownIcon, GitBranchIcon, TagIcon } from "lucide-react";
import { Dispatch, ReactNode, SetStateAction, useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";

type TProps = {
  service: TServiceShallow;
  className?: string;
};

export default function ServicePanelContentUndeployed({ service, className }: TProps) {
  const {
    teamId,
    projectId,
    environmentId,
    query: { refetch: refetchService },
  } = useService();
  const { refetch: refetchServices } = useServicesUtils({ teamId, projectId, environmentId });
  const {
    query: { refetch: refetchDeployments },
  } = useDeployments();

  const [variables, setVariables] = useState<TVariableForCreate[]>([]);

  const { mutateAsync: createDeployment, error: deploymentError } =
    api.deployments.create.useMutation();
  const { mutateAsync: upsertVariables, error: errorVariables } =
    api.variables.createOrUpdate.useMutation();

  const tagState = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: {},
    validators: {},
    onSubmit: async ({ formApi }) => {
      const parsedVariables: TCreateVariablesForm = { variables: [] };

      for (const variable of variables) {
        const { success, data } = VariableForCreateSchema.safeParse(variable);
        if (success) {
          parsedVariables.variables.push(data);
        }
      }

      const { success, data } = CreateVariablesFormSchema.safeParse(parsedVariables);

      if (success) {
        await upsertVariables({
          teamId,
          projectId,
          environmentId,
          serviceId: service.id,
          variables: data.variables,
          variableReferences: [],
          type: "service",
        });
      }

      await createDeployment({
        teamId,
        projectId,
        environmentId,
        serviceId: service.id,
      });

      await Promise.all([refetchServices(), refetchService(), refetchDeployments()]);

      formApi.reset();
    },
  });

  return (
    <div
      className={cn("mt-4 flex w-full flex-1 flex-col overflow-hidden border-t sm:mt-6", className)}
    >
      <ScrollArea viewportClassName="pb-[calc(var(--safe-area-inset-bottom)+2rem)]">
        <div className="flex w-full flex-1 flex-col gap-4 overflow-auto px-3 py-4 sm:p-6">
          <h2 className="-mt-1 px-2 text-xl font-bold sm:text-2xl">Deploy Service</h2>
          <Content service={service} tagState={tagState} />
          <VariablesProvider
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
            serviceId={service.id}
            type="service"
          >
            <VariableReferencesProvider
              type="service"
              teamId={teamId}
              projectId={projectId}
              environmentId={environmentId}
              serviceId={service.id}
            >
              <CreateVariablesForm
                variant="collapsible"
                onBlur={(v) => {
                  setVariables(v.value.variables);
                }}
              />
            </VariableReferencesProvider>
          </VariablesProvider>
          {deploymentError && <ErrorLine message={deploymentError.message} />}
          {errorVariables && <ErrorLine message={errorVariables.message} />}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting, state.values]}
              children={([canSubmit, isSubmitting]) => (
                <form.SubmitButton
                  className="w-full"
                  disabled={!canSubmit}
                  isPending={isSubmitting ? true : false}
                >
                  Deploy
                </form.SubmitButton>
              )}
            />
          </form>
        </div>
      </ScrollArea>
    </div>
  );
}

type TTagState = [string | null, Dispatch<SetStateAction<string | null>>];

function Content({ service, tagState }: { service: TServiceShallow; tagState: TTagState }) {
  if (service.config.type === "docker-image") {
    const arr = service.config.image?.split(":");
    const image = arr?.[0];
    const tag = arr?.[1] || "latest";

    if (!image || !tag) return <ErrorLine message="Image or tag is not found." />;

    return <DockerImageContent image={image} tag={tag} tagState={tagState} />;
  }

  if (service.config.type === "github") {
    if (!service.git_repository_owner || !service.git_repository || !service.config.git_branch) {
      return <ErrorLine message="Git owner, repository or branch is not found." />;
    }

    return (
      <GitContent
        owner={service.git_repository_owner}
        repo={service.git_repository}
        branch={service.config.git_branch}
      />
    );
  }

  return <ErrorLine message="Service type is not supported." />;
}

function Block({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-2 flex w-[calc(100%+1rem)] flex-col gap-4 md:flex-row md:gap-0">
      {children}
    </div>
  );
}

function BlockItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-1 px-2 md:w-1/2">
      <p className="w-full px-2 leading-tight font-semibold">{title}</p>
      {children}
    </div>
  );
}

function GitContent({ repo, owner, branch }: { repo: string; owner: string; branch: string }) {
  return (
    <Block>
      <BlockItem title="Repository">
        <div className="mt-1 flex w-full flex-row items-center gap-2 rounded-xl border px-3.5 py-3">
          <BrandIcon brand="github" color="brand" className="size-5 shrink-0" />
          <p className="min-w-0 shrink truncate leading-tight font-medium">{`${owner}/${repo}`}</p>
        </div>
      </BlockItem>
      <BlockItem title="Branch">
        <div className="mt-1 flex w-full flex-row items-center gap-2 rounded-xl border px-3.5 py-3">
          <GitBranchIcon className="size-5 shrink-0 scale-90" />
          <p className="min-w-0 shrink truncate leading-tight font-medium">{branch}</p>
        </div>
      </BlockItem>
    </Block>
  );
}

const placeholderArray = Array.from({ length: 10 });

function DockerImageContent({
  image,
  tag,
  tagState,
}: {
  image: string;
  tag: string;
  tagState: TTagState;
}) {
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [currentTag, setCurrentTag] = tagState;

  const [commandValue, setCommandValue] = useState("");
  const [commandInputValue, setCommandInputValue] = useState("");

  const [search] = useDebounce(commandInputValue, defaultDebounceMs);
  const { data, isPending, error } = api.docker.listTags.useQuery({
    repository: image,
    search: commandInputValue ? search : commandInputValue,
  });

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const timeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      scrollAreaRef.current?.scrollTo({ top: 0 });
    });

    if (data && data.tags.length > 0) {
      setCommandValue(data.tags[0].name);
    }

    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [data]);

  return (
    <Block>
      <BlockItem title="Image">
        <div className="mt-1 flex w-full flex-row items-center gap-2 rounded-xl border px-3.5 py-3">
          <BrandIcon brand="docker" color="brand" className="size-5 shrink-0" />
          <p className="min-w-0 shrink truncate leading-tight font-medium">{image}</p>
        </div>
      </BlockItem>
      <BlockItem title="Tag">
        <Popover open={isTagDropdownOpen} onOpenChange={setIsTagDropdownOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              data-open={isTagDropdownOpen ? true : undefined}
              className="group/button mt-1 flex w-full flex-row items-center justify-start gap-2 rounded-xl border px-3.5 py-3 text-left"
            >
              <TagIcon className="size-5 shrink-0 scale-90" />
              <p className="min-w-0 flex-1 shrink truncate leading-tight font-medium">
                {currentTag || tag}
              </p>
              <ChevronDownIcon className="text-muted-foreground -mr-0.5 size-5 transition group-data-open/button:rotate-180" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="flex h-68 max-h-[min(30rem,var(--radix-popper-available-height))] overflow-hidden rounded-xl p-0">
            <Command
              value={commandValue}
              onValueChange={setCommandValue}
              shouldFilter={false}
              wrapper="none"
              className="flex flex-1 flex-col"
            >
              <CommandInput
                value={commandInputValue}
                onValueChange={setCommandInputValue}
                showSpinner={isPending}
                placeholder="Search tags..."
              />
              <ScrollArea viewportRef={scrollAreaRef} className="flex flex-1 flex-col">
                <CommandList>
                  {data && (
                    <CommandEmpty className="text-muted-foreground flex items-center justify-start gap-2 px-2.5 py-2.5 leading-tight">
                      <TagIcon className="size-4.5 shrink-0" />
                      <p className="min-w-0 shrink">No tags found</p>
                    </CommandEmpty>
                  )}
                  <CommandGroup>
                    {!data &&
                      isPending &&
                      placeholderArray.map((_, index) => (
                        <CommandItem disabled className="rounded-lg" key={index}>
                          <p className="bg-foreground animate-skeleton min-w-0 shrink rounded-md leading-tight">
                            Loading {index}
                          </p>
                        </CommandItem>
                      ))}
                    {!data && !isPending && error && (
                      <ErrorCard className="rounded-lg" message={error.message} />
                    )}
                    {data &&
                      data.tags.map((tag) => (
                        <CommandItem
                          onSelect={(v) => {
                            setCurrentTag(v);
                            setIsTagDropdownOpen(false);
                            setCommandInputValue("");
                          }}
                          className="rounded-lg"
                          key={tag.name}
                        >
                          <p className="min-w-0 shrink leading-tight">{tag.name}</p>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </ScrollArea>
            </Command>
          </PopoverContent>
        </Popover>
      </BlockItem>
    </Block>
  );
}
