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
} from "@/components/block";
import {
  stagedString,
  useResetFormOnStagedChange,
  useServiceChanges,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
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
import { TServiceShallow } from "@/lib/queries/services";
import { dockerTagsQuery } from "@/lib/queries/docker";
import { gitRepositoryQuery } from "@/lib/queries/git";
import { useQuery } from "@tanstack/react-query";
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
  const { staged, stage } = useServiceChanges(service);

  const {
    data: dataRepository,
    isPending: isPendingRepository,
    error: errorRepository,
  } = useQuery(gitRepositoryQuery({ installationId, owner, repoName: repo }));

  const form = useAppForm({
    defaultValues: {
      branch: stagedString(staged.gitBranch, branch),
    },
  });
  useResetFormOnStagedChange(form, staged, ["gitBranch"]);

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

  return (
    <SettingsSection
      title="Source"
      id="source"
      entityId={`source-${service.id}`}
      Icon={CodeIcon}
      classNameContent="gap-5"
      hasChanges={staged.gitBranch !== undefined}
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
                <BrandIcon brand="github" color="brand" className={cn(className, "size-4.5")} />
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
                <BlockItemTitle hasChanges={staged.gitBranch !== undefined}>Branch</BlockItemTitle>
              </BlockItemHeader>
              <BlockItemContent>
                <field.AsyncAndSearchableSelect
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onChange={(v) => {
                    field.handleChange(v);
                    stage({ field: "gitBranch", label: "Branch", value: v, previous: branch });
                  }}
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
                        <GitBranchIcon className={cn(className, "size-4.5")} />
                      )}
                      variant="outline"
                      open={isOpen}
                      onBlur={field.handleBlur}
                    />
                  )}
                </field.AsyncAndSearchableSelect>
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
  const { staged, stage } = useServiceChanges(service);

  const serverImage = `${image}:${tag}`;
  const stagedImage = stagedString(staged.image, serverImage);

  const form = useAppForm({
    defaultValues: {
      tag: stagedImage.split(":")[1] ?? tag,
    },
  });
  useResetFormOnStagedChange(form, staged, ["image"]);

  const {
    data: dataTags,
    isPending: isPendingTags,
    error: errorTags,
  } = useQuery({
    ...dockerTagsQuery({
      repository: image,
      search: commandInputValue ? search : commandInputValue,
    }),
    enabled: !imageIsNonDockerHub,
  });

  const tagItems: TCommandItem[] | undefined = useMemo(() => {
    const items: TCommandItem[] | undefined = dataTags?.tags?.map((b) => ({
      value: b.name,
      label: b.name,
    }));
    return items;
  }, [dataTags]);

  return (
    <SettingsSection
      title="Source"
      id="source"
      entityId={`source-${service.id}`}
      Icon={CodeIcon}
      classNameContent="gap-5"
      hasChanges={staged.image !== undefined}
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
                  return <PackageIcon className={className} />;
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
                <BlockItemTitle hasChanges={staged.image !== undefined}>Tag</BlockItemTitle>
              </BlockItemHeader>
              <BlockItemContent>
                <field.AsyncAndSearchableSelect
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onChange={(v) => {
                    field.handleChange(v);
                    stage({
                      field: "image",
                      label: "Image",
                      value: `${image}:${v}`,
                      previous: serverImage,
                    });
                  }}
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
                      Icon={({ className }) => <TagIcon className={cn(className, "size-4.5")} />}
                      variant="outline"
                      open={isOpen}
                      onBlur={field.handleBlur}
                      disabled={imageIsNonDockerHub}
                      hideChevron={imageIsNonDockerHub}
                      fadeOnDisabled={false}
                    />
                  )}
                </field.AsyncAndSearchableSelect>
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
                <BrandIcon brand={type} color="brand" className={cn(className, "size-4.5")} />
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
              Icon={({ className }) => <MilestoneIcon className={cn(className, "size-4.5")} />}
            />
          </BlockItemContent>
        </BlockItem>
      </Block>
    </SettingsSection>
  );
}

function getEntityId(service: TServiceShallow): string {
  return `source_${service.id}`;
}
