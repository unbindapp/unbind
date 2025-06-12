import { databaseTypeToName } from "@/components/command-panel/context-command-panel/items/database";
import { isNonDockerHubImage } from "@/components/command-panel/context-command-panel/items/docker-image";
import BrandIcon from "@/components/icons/brand";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import useUpdateService, {
  TUpdateServiceInputSimple,
} from "@/components/service/use-update-service";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  TDatabaseSectionProps,
  TDockerImageSectionProps,
  TGitSectionProps,
} from "@/components/settings/types";
import { cn } from "@/components/ui/utils";
import { defaultDebounceMs } from "@/lib/constants";
import { TCommandItem, useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";
import { useStore } from "@tanstack/react-form";
import { CodeIcon, GitBranchIcon, MilestoneIcon, PackageIcon, TagIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useDebounce } from "use-debounce";

type TProps = {
  service: TServiceShallow;
};

export default function SourceSection({ service }: TProps) {
  if (service.type === "github") {
    if (
      !service.git_repository_owner ||
      !service.git_repository ||
      !service.config.git_branch ||
      service.github_installation_id === undefined
    ) {
      return (
        <ErrorWithWrapper message="Git owner, repository, installation ID, or branch is not found." />
      );
    }

    return (
      <GitSection
        owner={service.git_repository_owner}
        repo={service.git_repository}
        branch={service.config.git_branch}
        installationId={service.github_installation_id}
        service={service}
      />
    );
  }

  if (service.type === "docker-image") {
    const arr = service.config.image?.split(":");
    const image = arr?.[0];
    const tag = arr && arr.length > 1 ? arr?.[1] : "latest";

    if (!image || !tag) return <ErrorWithWrapper message="Image or tag is not found." />;

    return <DockerImageSection image={image} tag={tag} service={service} />;
  }

  if (service.type === "database") {
    if (!service.database_type || !service.database_version) {
      return <ErrorWithWrapper message="Database type or version is not found." />;
    }

    return (
      <DatabaseSection
        type={service.database_type}
        version={service.database_version}
        service={service}
      />
    );
  }

  return <ErrorWithWrapper message="Unsupported service type" />;
}

function GitSection({ owner, repo, branch, installationId, service }: TGitSectionProps) {
  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);

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
  });

  const {
    data: dataRepository,
    isPending: isPendingRepository,
    error: errorRepository,
  } = api.git.getRepository.useQuery({
    owner,
    repoName: repo,
    installationId,
  });

  const form = useAppForm({
    defaultValues: {
      branch,
    },
    onSubmit: async ({ value, formApi }) => {
      let hasChanged = false;
      const changes: TUpdateServiceInputSimple = {};

      if (formApi.getFieldMeta("branch")?.isDefaultValue === false) {
        hasChanged = true;
        changes.gitBranch = value.branch;
      }

      if (hasChanged) {
        await updateService(changes);
      } else {
        form.reset();
      }
    },
  });

  const branchItems: TCommandItem[] | undefined = useMemo(() => {
    const items: TCommandItem[] | undefined = dataRepository?.repository.branches?.map((b) => ({
      value: b.name,
      label: b.name,
    }));
    return items;
  }, [dataRepository]);

  const repositoryBlockProps = dataRepository?.repository.htmlUrl
    ? ({
        asElement: "LinkButton",
        href: dataRepository.repository.htmlUrl,
      } as const)
    : ({ asElement: "div" } as const);

  const changeCount = useStore(form.store, (s) => {
    let count = 0;
    if (s.fieldMeta.branch?.isDefaultValue === false) count++;
    return count;
  });

  return (
    <SettingsSection
      asElement="form"
      title="Source"
      id="source"
      entityId={`source-${service.id}`}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit(e);
      }}
      SubmitButton={form.SubmitButton}
      error={errorUpdate?.message}
      isPending={isPendingUpdate}
      Icon={CodeIcon}
      changeCount={changeCount}
      onClickResetChanges={() => {
        form.reset();
        resetUpdate();
      }}
      classNameContent="gap-5"
    >
      <Block>
        <BlockItem className="w-full md:w-full">
          <BlockItemHeader>
            <BlockItemTitle>Repository</BlockItemTitle>
          </BlockItemHeader>
          <BlockItemContent>
            <BlockItemButtonLike
              {...repositoryBlockProps}
              text={`${owner}/${repo}`}
              Icon={({ className }) => (
                <BrandIcon brand="github" color="brand" className={className} />
              )}
            />
          </BlockItemContent>
        </BlockItem>
      </Block>
      <Block>
        <form.AppField
          name="branch"
          children={(field) => (
            <BlockItem className="w-full md:w-full">
              <BlockItemHeader>
                <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                  Branch
                </BlockItemTitle>
              </BlockItemHeader>
              <BlockItemContent>
                <field.AsyncCommandDropdown
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  items={branchItems}
                  isPending={isPendingRepository}
                  error={errorRepository?.message}
                  commandInputPlaceholder="Search branches..."
                  CommandEmptyText="No branches found"
                  CommandEmptyIcon={GitBranchIcon}
                >
                  {({ isOpen }) => (
                    <BlockItemButtonLike
                      asElement="button"
                      text={field.state.value}
                      Icon={({ className }) => (
                        <GitBranchIcon className={cn("scale-90", className)} />
                      )}
                      variant="outline"
                      open={isOpen}
                      onBlur={field.handleBlur}
                    />
                  )}
                </field.AsyncCommandDropdown>
              </BlockItemContent>
            </BlockItem>
          )}
        />
      </Block>
    </SettingsSection>
  );
}

function DockerImageSection({ image, tag, service }: TDockerImageSectionProps) {
  const [commandInputValue, setCommandInputValue] = useState("");
  const imageIsNonDockerHub = isNonDockerHubImage(image);
  const [search] = useDebounce(commandInputValue, defaultDebounceMs);

  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);

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
  });

  const form = useAppForm({
    defaultValues: {
      tag,
    },
    onSubmit: async ({ formApi, value }) => {
      let hasChanged = false;
      const changes: TUpdateServiceInputSimple = {};

      if (formApi.getFieldMeta("tag")?.isDefaultValue === false) {
        hasChanged = true;
        changes.image = `${image}:${value.tag}`;
      }

      if (hasChanged) {
        await updateService(changes);
      } else {
        form.reset();
      }
    },
  });

  const {
    data: dataTags,
    isPending: isPendingTags,
    error: errorTags,
  } = api.docker.listTags.useQuery(
    {
      repository: image,
      search: commandInputValue ? search : commandInputValue,
    },
    {
      enabled: !imageIsNonDockerHub,
    },
  );

  const tagItems: TCommandItem[] | undefined = useMemo(() => {
    const items: TCommandItem[] | undefined = dataTags?.tags?.map((b) => ({
      value: b.name,
      label: b.name,
    }));
    return items;
  }, [dataTags]);

  const changeCount = useStore(form.store, (s) => {
    let count = 0;
    if (s.fieldMeta.tag?.isDefaultValue === false) count++;
    return count;
  });

  return (
    <SettingsSection
      asElement="form"
      title="Source"
      id="source"
      entityId={`source-${service.id}`}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit(e);
      }}
      SubmitButton={form.SubmitButton}
      isPending={isPendingUpdate}
      error={errorUpdate?.message}
      Icon={CodeIcon}
      changeCount={changeCount}
      onClickResetChanges={() => {
        form.reset();
        resetUpdate();
      }}
      classNameContent="gap-5"
    >
      <Block>
        <BlockItem className="w-full md:w-full">
          <BlockItemHeader>
            <BlockItemTitle>Image</BlockItemTitle>
          </BlockItemHeader>
          <BlockItemContent>
            <BlockItemButtonLike
              asElement="LinkButton"
              href={imageIsNonDockerHub ? `https://${image}` : `https://hub.docker.com/r/${image}`}
              text={image}
              Icon={({ className }) => {
                if (imageIsNonDockerHub) {
                  return <PackageIcon className={cn("scale-90", className)} />;
                }
                return <BrandIcon brand="docker" color="brand" className={className} />;
              }}
            />
          </BlockItemContent>
        </BlockItem>
      </Block>
      <Block>
        <form.AppField
          name="tag"
          children={(field) => (
            <BlockItem className="w-full md:w-full">
              <BlockItemHeader>
                <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>Tag</BlockItemTitle>
              </BlockItemHeader>
              <BlockItemContent>
                <field.AsyncCommandDropdown
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  items={tagItems}
                  isPending={isPendingTags}
                  error={errorTags?.message}
                  commandInputPlaceholder="Search tags..."
                  CommandEmptyText="No tags found"
                  CommandEmptyIcon={TagIcon}
                  commandShouldntFilter={true}
                  commandInputValue={commandInputValue}
                  commandInputValueOnChange={(v) => setCommandInputValue(v)}
                >
                  {({ isOpen }) => (
                    <BlockItemButtonLike
                      asElement="button"
                      text={field.state.value}
                      Icon={({ className }) => <TagIcon className={cn("scale-90", className)} />}
                      variant="outline"
                      open={isOpen}
                      onBlur={field.handleBlur}
                      disabled={imageIsNonDockerHub}
                      hideChevron={imageIsNonDockerHub}
                      fadeOnDisabled={false}
                    />
                  )}
                </field.AsyncCommandDropdown>
              </BlockItemContent>
            </BlockItem>
          )}
        />
      </Block>
    </SettingsSection>
  );
}

function DatabaseSection({ type, version, service }: TDatabaseSectionProps) {
  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);

  return (
    <SettingsSection
      title="Source"
      id="source"
      entityId={sectionHighlightId}
      Icon={CodeIcon}
      classNameContent="gap-5"
    >
      <Block>
        {/* Database */}
        <BlockItem className="w-full md:w-full">
          <BlockItemHeader>
            <BlockItemTitle>Database</BlockItemTitle>
          </BlockItemHeader>
          <BlockItemContent>
            <BlockItemButtonLike
              asElement="div"
              text={databaseTypeToName(type)}
              Icon={({ className }) => (
                <BrandIcon brand={type} color="brand" className={className} />
              )}
            />
          </BlockItemContent>
        </BlockItem>
      </Block>
      <Block>
        {/* Version */}
        <BlockItem className="w-full md:w-full">
          <BlockItemHeader>
            <BlockItemTitle>Version</BlockItemTitle>
          </BlockItemHeader>
          <BlockItemContent>
            <BlockItemButtonLike
              asElement="div"
              text={version}
              Icon={({ className }) => <MilestoneIcon className={cn("scale-90", className)} />}
            />
          </BlockItemContent>
        </BlockItem>
      </Block>
    </SettingsSection>
  );
}

function getEntityId(service: TServiceShallow): string {
  return `source-${service.id}`;
}
