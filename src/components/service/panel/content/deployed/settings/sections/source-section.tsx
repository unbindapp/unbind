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
import { useService } from "@/components/service/service-provider";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  TDatabaseSectionProps,
  TDockerImageSectionProps,
  TGitSectionProps,
} from "@/components/settings/types";
import S3SourcesProvider from "@/components/storage/s3-sources-provider";
import { cn } from "@/components/ui/utils";
import { defaultDebounceMs } from "@/lib/constants";
import { TCommandItem, useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";
import { CodeIcon, GitBranchIcon, MilestoneIcon, PackageIcon, TagIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useDebounce } from "use-debounce";

type TProps = {
  service: TServiceShallow;
};

export default function SourceSection({ service }: TProps) {
  const { teamId } = useService();

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

    return <DockerImageSection image={image} tag={tag} />;
  }

  if (service.type === "database") {
    if (!service.database_type || !service.database_version) {
      return <ErrorWithWrapper message="Database type or version is not found." />;
    }

    return (
      <S3SourcesProvider teamId={teamId}>
        <DatabaseSection type={service.database_type} version={service.database_version} />
      </S3SourcesProvider>
    );
  }

  return <ErrorWithWrapper message="Unsupported service type" />;
}

function GitSection({ owner, repo, branch, installationId }: TGitSectionProps) {
  const {
    data: dataRepository,
    isPending: isPendingRepository,
    error: errorRepository,
  } = api.git.getRepository.useQuery({
    owner,
    repoName: repo,
    installationId,
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

  const form = useAppForm({
    defaultValues: {
      branch,
    },
    onSubmit: async () => {},
  });

  return (
    <SettingsSection
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      asElement="form"
      title="Source"
      id="source"
      Icon={CodeIcon}
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
        <BlockItem className="w-full md:w-full">
          <BlockItemHeader>
            <BlockItemTitle>Branch</BlockItemTitle>
          </BlockItemHeader>
          <BlockItemContent>
            <form.AppField
              name="branch"
              children={(field) => (
                <field.AsyncCommandDropdown
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  items={branchItems}
                  isPending={isPendingRepository}
                  error={errorRepository?.message}
                  commandInputPlaceholder="Search branches..."
                  commandEmptyText="No branches found"
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
              )}
            />
          </BlockItemContent>
        </BlockItem>
      </Block>
    </SettingsSection>
  );
}

function DatabaseSection({ type, version }: TDatabaseSectionProps) {
  return (
    <SettingsSection title="Source" id="source" Icon={CodeIcon}>
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

function DockerImageSection({ image, tag }: TDockerImageSectionProps) {
  const [commandInputValue, setCommandInputValue] = useState("");
  const imageIsNonDockerHub = isNonDockerHubImage(image);
  const [search] = useDebounce(commandInputValue, defaultDebounceMs);

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

  const form = useAppForm({
    defaultValues: {
      tag,
    },
    onSubmit: async () => {},
  });

  return (
    <SettingsSection
      asElement="form"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      title="Source"
      id="source"
      Icon={CodeIcon}
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
      <form
        className="flex w-full flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit(e);
        }}
      >
        <Block>
          <BlockItem className="w-full md:w-full">
            <BlockItemHeader>
              <BlockItemTitle>Tag</BlockItemTitle>
            </BlockItemHeader>
            <BlockItemContent>
              <form.AppField
                name="tag"
                children={(field) => (
                  <field.AsyncCommandDropdown
                    dontCheckUntilSubmit
                    field={field}
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    items={tagItems}
                    isPending={isPendingTags}
                    error={errorTags?.message}
                    commandInputPlaceholder="Search tags..."
                    commandEmptyText="No tags found"
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
                )}
              />
            </BlockItemContent>
          </BlockItem>
        </Block>
      </form>
    </SettingsSection>
  );
}
