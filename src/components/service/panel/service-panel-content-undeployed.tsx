import ErrorCard from "@/components/error-card";
import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { useServicesUtils } from "@/components/project/services-provider";
import { useDeployments } from "@/components/service/deployments-provider";
import { useService } from "@/components/service/service-provider";
import { useSystem } from "@/components/system/system-provider";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
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
import { CheckCircleIcon, ChevronDownIcon, GitBranchIcon, TagIcon } from "lucide-react";
import {
  Children,
  cloneElement,
  Dispatch,
  isValidElement,
  ReactNode,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDebounce } from "use-debounce";
import { z } from "zod";

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
  const branchState = useState<string | null>(null);
  const [domain, setDomain] = useState<string>("");

  const port =
    service.config.ports && service.config.ports?.length > 0 ? service.config.ports[0].port : null;
  const [portInputValue, setPortInputValue] = useState<string>(port?.toString() || "");

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
        <div className="flex w-full flex-1 flex-col gap-5 overflow-auto px-3 py-4 sm:p-6">
          <h2 className="-mt-1 px-2 text-xl font-bold sm:text-2xl">Deploy Service</h2>
          <Content service={service} tagState={tagState} branchState={branchState} />
          <Block>
            <BlockItem>
              <BlockItemHeader>
                <BlockItemTitle>Domain</BlockItemTitle>
              </BlockItemHeader>
              <BlockItemContent>
                <div className="flex w-full flex-col items-start gap-2">
                  <Input
                    value={domain}
                    onChange={(e) => setDomain(e.currentTarget.value)}
                    placeholder="example.com"
                    className="w-full rounded-xl px-3.5 py-3"
                  />
                  <DomainCard domain={domain} />
                </div>
              </BlockItemContent>
            </BlockItem>
            <BlockItem>
              <BlockItemHeader>
                <BlockItemTitle>Port</BlockItemTitle>
              </BlockItemHeader>
              <BlockItemContent>
                <div className="flex w-full flex-col items-start gap-2">
                  <Input
                    value={portInputValue}
                    onChange={(e) => setPortInputValue(e.target.value)}
                    placeholder="3000"
                    className="w-full rounded-xl px-3.5 py-3"
                  />
                  {port !== null && (
                    <div className="text-success bg-success/10 border-success/10 flex w-full items-center justify-start gap-1.25 rounded-lg border px-2 py-1">
                      <CheckCircleIcon className="-ml-0.25 size-3.5 shrink-0" />
                      <p className="min-w-0 shrink text-sm leading-tight font-medium">
                        Automatically detected port: <span className="font-bold">{port}</span>
                      </p>
                    </div>
                  )}
                </div>
              </BlockItemContent>
            </BlockItem>
          </Block>
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

type TStringOrNullState = [string | null, Dispatch<SetStateAction<string | null>>];

function Content({
  service,
  tagState,
  branchState,
}: {
  service: TServiceShallow;
  tagState: TStringOrNullState;
  branchState: TStringOrNullState;
}) {
  if (service.config.type === "docker-image") {
    const arr = service.config.image?.split(":");
    const image = arr?.[0];
    const tag = arr?.[1] || "latest";

    if (!image || !tag) return <ErrorLine message="Image or tag is not found." />;

    return <DockerImageContent image={image} tag={tag} tagState={tagState} />;
  }

  if (service.config.type === "github") {
    if (
      !service.git_repository_owner ||
      !service.git_repository ||
      !service.config.git_branch ||
      service.github_installation_id === undefined
    ) {
      return (
        <ErrorLine message="Git owner, repository, installation ID, or branch is not found." />
      );
    }

    return (
      <GitContent
        owner={service.git_repository_owner}
        repo={service.git_repository}
        branch={service.config.git_branch}
        installationId={service.github_installation_id}
        branchState={branchState}
      />
    );
  }

  return <ErrorLine message="Service type is not supported." />;
}

function GitContent({
  repo,
  owner,
  branch,
  installationId,
  branchState,
}: {
  repo: string;
  owner: string;
  branch: string;
  installationId: number;
  branchState: TStringOrNullState;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentBranch, setCurrentBranch] = branchState;

  const [commandValue, setCommandValue] = useState("");

  const { data, isPending, error } = api.git.getRepository.useQuery({
    owner,
    repoName: repo,
    installationId,
  });

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const timeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      scrollAreaRef.current?.scrollTo({ top: 0 });
    });

    if (data?.repository.branches && data.repository.branches.length > 0) {
      setCommandValue(data.repository.branches[0].name);
    }

    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [data]);

  return (
    <Block>
      <BlockItem>
        <BlockItemHeader>
          <BlockItemTitle>Repository</BlockItemTitle>
        </BlockItemHeader>
        <BlockItemContent>
          <div className="flex w-full flex-row items-center gap-2 rounded-xl border px-3.5 py-3">
            <BrandIcon brand="github" color="brand" className="size-5 shrink-0" />
            <p className="min-w-0 shrink truncate leading-tight font-medium">{`${owner}/${repo}`}</p>
          </div>
        </BlockItemContent>
      </BlockItem>
      <BlockItem>
        <BlockItemHeader>
          <BlockItemTitle>Branch</BlockItemTitle>
        </BlockItemHeader>
        <BlockItemContent>
          <Popover open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                data-open={isDropdownOpen ? true : undefined}
                className="group/button flex w-full flex-row items-center justify-start gap-2 rounded-xl border px-3.5 py-3 text-left"
              >
                <GitBranchIcon className="size-5 shrink-0 scale-90" />
                <p className="min-w-0 flex-1 shrink truncate leading-tight font-medium">
                  {currentBranch || branch}
                </p>
                <ChevronDownIcon className="text-muted-foreground -mr-1 size-5 transition group-data-open/button:rotate-180" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              animate={false}
              className="flex h-68 max-h-[min(30rem,var(--radix-popper-available-height))] overflow-hidden rounded-xl p-0"
            >
              <Command
                value={commandValue}
                onValueChange={setCommandValue}
                shouldFilter={isPending ? false : true}
                wrapper="none"
                className="flex flex-1 flex-col"
              >
                <CommandInput showSpinner={isPending} placeholder="Search branches..." />
                <ScrollArea viewportRef={scrollAreaRef} className="flex flex-1 flex-col">
                  <CommandList>
                    {data && (
                      <CommandEmpty className="text-muted-foreground flex items-center justify-start gap-2 px-2.5 py-2.5 leading-tight">
                        <GitBranchIcon className="size-4.5 shrink-0" />
                        <p className="min-w-0 shrink">No branch found</p>
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
                        data.repository.branches?.map((branch) => (
                          <CommandItem
                            onSelect={(v) => {
                              setCurrentBranch(v);
                              setIsDropdownOpen(false);
                            }}
                            className="rounded-lg"
                            key={branch.name}
                          >
                            <p className="min-w-0 shrink leading-tight">{branch.name}</p>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </ScrollArea>
              </Command>
            </PopoverContent>
          </Popover>
        </BlockItemContent>
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
  tagState: TStringOrNullState;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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
      <BlockItem>
        <BlockItemHeader>
          <BlockItemTitle>Image</BlockItemTitle>
        </BlockItemHeader>
        <BlockItemContent>
          <div className="flex w-full flex-row items-center gap-2 rounded-xl border px-3.5 py-3">
            <BrandIcon brand="docker" color="brand" className="size-5 shrink-0" />
            <p className="min-w-0 shrink truncate leading-tight font-medium">{image}</p>
          </div>
        </BlockItemContent>
      </BlockItem>
      <BlockItem>
        <BlockItemHeader>
          <BlockItemTitle>Tag</BlockItemTitle>
        </BlockItemHeader>
        <BlockItemContent>
          <Popover open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                data-open={isDropdownOpen ? true : undefined}
                className="group/button flex w-full flex-row items-center justify-start gap-2 rounded-xl border px-3.5 py-3 text-left"
              >
                <TagIcon className="size-5 shrink-0 scale-90" />
                <p className="min-w-0 flex-1 shrink truncate leading-tight font-medium">
                  {currentTag || tag}
                </p>
                <ChevronDownIcon className="text-muted-foreground -mr-1 size-5 transition group-data-open/button:rotate-180" />
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
                              setIsDropdownOpen(false);
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
        </BlockItemContent>
      </BlockItem>
    </Block>
  );
}

const DomainSchema = z
  .string()
  .nonempty()
  .refine((val) => !val.includes(" "), "Domain can't contain spaces")
  .refine((val) => val.includes("."), "Domain must contain a dot");

function DomainCard({ domain }: { domain: string }) {
  const { data, isPending, error } = useSystem();
  const [isValidDomain, setIsValidDomain] = useState(false);

  useEffect(() => {
    const { success } = DomainSchema.safeParse(domain);
    setIsValidDomain(success);
  }, [domain]);

  if (!isValidDomain) return null;

  return (
    <div
      data-pending={!data && isPending ? true : undefined}
      data-error={!data && !isPending && error ? true : undefined}
      className="group/card flex w-full flex-col items-start justify-start gap-1 rounded-xl border text-sm select-text"
    >
      <div className="flex w-full items-start justify-start gap-6 px-3 pt-2 pb-2.5">
        <div className="flex flex-col gap-0.5">
          <p className="text-muted-foreground leading-tight">Type</p>
          <p className="leading-tight font-medium">A</p>
        </div>
        <div className="flex min-w-0 shrink flex-col gap-0.5">
          <p className="text-muted-foreground leading-tight">Name</p>
          <p className="leading-tight font-medium">{domain}</p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-muted-foreground leading-tight">Content</p>
          <p className="group-data-error/card:text-destructive group-data-pending/card:animate-skeleton group-data-pending/card:bg-foreground leading-tight font-medium group-data-pending/card:rounded-md group-data-pending/card:text-transparent">
            {data
              ? data?.data.external_ipv4 || data?.data.external_ipv6
              : error
                ? "Error"
                : "Loading..."}
          </p>
        </div>
      </div>
      {error && (
        <div className="w-full px-1.5 pb-1.5">
          <ErrorLine message={error.message} className="rounded-lg" />
        </div>
      )}
    </div>
  );
}

function Block({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-2 -mt-1 flex w-[calc(100%+1rem)] flex-col gap-4 md:flex-row md:gap-0">
      {children}
    </div>
  );
}

function BlockItemHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center justify-start gap-2.5 px-2 pb-1 leading-tight font-semibold">
      {children}
    </div>
  );
}

function BlockItemTitle({ children }: { children: ReactNode }) {
  return <p className="min-w-0 shrink truncate leading-tight font-semibold">{children}</p>;
}

function BlockItemContent({
  children,
  ...rest
}: {
  children: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}) {
  if (isValidElement(children)) {
    const childrenProps = (children.props || {}) as { className?: string };
    const { className: restClassName, ...restWithoutClassName } = rest;
    const mergedProps = {
      ...childrenProps,
      ...restWithoutClassName,
    };
    if (childrenProps.className || restClassName) {
      mergedProps.className = cn(childrenProps.className, restClassName);
    }
    return cloneElement(children, mergedProps);
  }
  return children;
}

function BlockItem({ children }: { children: ReactNode }) {
  const childrenArray = Children.toArray(children);
  const Header = childrenArray.find(
    (child) =>
      isValidElement(child) && typeof child.type === "function" && child.type === BlockItemHeader,
  );
  const Content = childrenArray.find(
    (child) =>
      isValidElement(child) && typeof child.type === "function" && child.type === BlockItemContent,
  );
  return (
    <div className="flex w-full flex-col gap-1 px-2 md:w-1/2">
      {Header}
      {Content}
    </div>
  );
}
