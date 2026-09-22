import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemHeader,
  BlockItemTitle,
  BlockItemToggle,
} from "@/components/block";
import { databaseTypeToName } from "@/components/command-panel/context-command-panel/items/database";
import {
  cleanSearch,
  isNonDockerHubImage,
} from "@/components/command-panel/context-command-panel/items/docker-image";
import BrandIcon from "@/components/icons/brand";
import { useSettingsSectionSearch } from "@/components/service/panel/content/deployed/settings/settings-search-provider";
import {
  hasApplying,
  stagedBoolean,
  stagedString,
  useResetFormOnStagedChange,
  useServiceChanges,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { settingsIds } from "@/components/settings/settings-ids";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  TDatabaseSectionProps,
  TDockerImageSectionProps,
  TGitSectionProps,
} from "@/components/settings/types";
import { TServiceChangeField } from "@/components/staged-changes/types";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { defaultDebounceMs } from "@/lib/constants";
import { formatKMBT } from "@/lib/helpers/format-kmbt";
import { TCommandItem, useAppForm } from "@/lib/hooks/use-app-form";
import { dockerSearchQuery, dockerTagsQuery } from "@/lib/queries/docker";
import { gitRepositoriesQuery, gitRepositoryQuery } from "@/lib/queries/git";
import { TServiceShallow } from "@/lib/queries/services";
import {
  gitRepositoryValue,
  parseGitRepositoryValue,
  type TGitRepositoryValue,
} from "@/lib/queries/update-service-input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CodeIcon,
  ExternalLink,
  GitBranchIcon,
  MilestoneIcon,
  PackageIcon,
  TagIcon,
  ZapIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounceValue } from "usehooks-ts";

type TProps = {
  service: TServiceShallow;
};

export default function SourceSection({ service }: TProps) {
  const { isSectionVisible } = useSettingsSectionSearch("source");
  if (!isSectionVisible) return null;
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
    if (!service.config.image) return <ErrorWithWrapper message="Image is not found." />;
    const { image, tag } = splitImage(service.config.image);
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

function formatRepository(value: string) {
  const repository = parseGitRepositoryValue(value);
  return repository ? `${repository.owner}/${repository.name}` : value;
}

function GitSection({ owner, repo, branch, installationId, service }: TGitSectionProps) {
  const { isItemVisible } = useSettingsSectionSearch("source");
  const queryClient = useQueryClient();
  const serverRepository = gitRepositoryValue({ installationId, owner, name: repo });
  const serverAutoDeploy = service.config.auto_deploy;
  const { staged, stage, unstage } = useServiceChanges(service, {
    gitRepository: serverRepository,
    gitBranch: branch,
    autoDeploy: serverAutoDeploy,
  });
  const stagedRef = useRef(staged);
  stagedRef.current = staged;
  const selectedRepository = parseGitRepositoryValue(
    stagedString(staged.gitRepository, serverRepository),
  ) ?? { installationId, owner, name: repo };

  const {
    data: dataRepositories,
    isPending: isPendingRepositories,
    error: errorRepositories,
  } = useQuery(gitRepositoriesQuery());

  const {
    data: dataRepository,
    isPending: isPendingRepository,
    error: errorRepository,
  } = useQuery(
    gitRepositoryQuery({
      installationId: selectedRepository.installationId,
      owner: selectedRepository.owner,
      repoName: selectedRepository.name,
    }),
  );

  const defaultValues = {
    repository: stagedString(staged.gitRepository, serverRepository),
    branch: stagedString(staged.gitBranch, branch),
  };
  const form = useAppForm({ defaultValues });
  useResetFormOnStagedChange(form, defaultValues, staged, ["gitRepository", "gitBranch"]);

  const repositoryItems: TCommandItem[] | undefined = useMemo(
    () =>
      dataRepositories?.repositories.map((r) => ({
        value: gitRepositoryValue({
          installationId: r.installation_id,
          owner: r.owner.login,
          name: r.name,
        }),
        label: r.full_name,
      })),
    [dataRepositories],
  );

  const branchItems: TCommandItem[] | undefined = useMemo(() => {
    const items: TCommandItem[] | undefined = dataRepository?.repository.branches?.map((b) => ({
      value: b.name,
      label: b.name,
    }));
    return items;
  }, [dataRepository]);

  // The repository is staged at once and the branch follows when the new repository's
  // default branch is known, so a stale branch never goes out. A deploy sent before then
  // carries no branch and the server picks the default one, the same value the lookup
  // would have staged. The latest pick wins over a slower earlier one.
  const [isResolvingBranch, setIsResolvingBranch] = useState(false);
  const resolveCounter = useRef(0);
  const stageRepository = (value: string) =>
    stage({
      field: "gitRepository",
      label: "Repository",
      value,
      previous: serverRepository,
      format: formatRepository,
    });
  const resolveBranch = async (repository: TGitRepositoryValue) => {
    const request = ++resolveCounter.current;
    setIsResolvingBranch(true);
    try {
      const { repository: detail } = await queryClient.fetchQuery(
        gitRepositoryQuery({
          installationId: repository.installationId,
          owner: repository.owner,
          repoName: repository.name,
        }),
      );
      if (request !== resolveCounter.current) return;
      if (stagedRef.current.gitRepository?.isApplying) return;
      form.setFieldValue("branch", detail.defaultBranch);
      stage({ field: "gitBranch", label: "Branch", value: detail.defaultBranch, previous: branch });
    } catch (error) {
      if (request !== resolveCounter.current) return;
      unstage(["gitRepository"]);
      toast.add({
        type: "error",
        title: "Could not read the repository",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        timeout: 5000,
      });
    } finally {
      if (request === resolveCounter.current) setIsResolvingBranch(false);
    }
  };
  const changeRepository = (value: string) => {
    const repository = parseGitRepositoryValue(value);
    if (!repository) return;
    if (value === serverRepository) {
      resolveCounter.current++;
      setIsResolvingBranch(false);
      form.setFieldValue("branch", branch);
      unstage(["gitRepository", "gitBranch"]);
      return;
    }
    stageRepository(value);
    unstage(["gitBranch"]);
    resolveBranch(repository);
  };

  // A reload inside the lookup leaves the repository staged without a branch, so the
  // lookup runs once more for it
  const stagedRepository = staged.gitRepository?.value;
  const hasStagedBranch = staged.gitBranch !== undefined;
  useEffect(() => {
    if (typeof stagedRepository !== "string" || hasStagedBranch || isResolvingBranch) return;
    const repository = parseGitRepositoryValue(stagedRepository);
    if (!repository) return;
    resolveBranch(repository);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedRepository]);

  const autoDeploy = stagedBoolean(staged.autoDeploy, serverAutoDeploy);

  const showRepository = isItemVisible(settingsIds.source.repository);
  const showBranch = isItemVisible(settingsIds.source.branch);
  const showAutoDeploy = isItemVisible(settingsIds.source.autoDeploy);
  if (!showRepository && !showBranch && !showAutoDeploy) return null;

  const fields: TServiceChangeField[] = ["gitRepository", "gitBranch", "autoDeploy"];

  return (
    <SettingsSection
      title="Source"
      id="source"
      entityId={`source-${service.id}`}
      Icon={CodeIcon}
      classNameContent="gap-5"
      hasChanges={fields.some((field) => staged[field] !== undefined)}
      isApplying={hasApplying(staged, fields)}
      onDiscard={() => unstage(fields)}
    >
      {showRepository && (
        <Block>
          <form.AppField
            name="repository"
            children={(field) => (
              <BlockItem id={settingsIds.source.repository} className="w-full md:w-full">
                <BlockItemHeader>
                  <BlockItemTitle>Repository</BlockItemTitle>
                  <SuffixExternalLink
                    href={`https://github.com/${selectedRepository.owner}/${selectedRepository.name}`}
                    label="Open repository on GitHub"
                  />
                </BlockItemHeader>
                <BlockItemContent>
                  <field.AsyncAndSearchableSelect
                    dontCheckUntilSubmit
                    field={field}
                    value={field.state.value}
                    onChange={(v) => {
                      if (v === field.state.value) return;
                      field.handleChange(v);
                      changeRepository(v);
                    }}
                    items={repositoryItems}
                    isPending={isPendingRepositories}
                    error={errorRepositories?.message}
                    commandInputPlaceholder="Search repositories..."
                    CommandEmptyText="No repositories found"
                    CommandEmptyIcon={({ className }) => (
                      <BrandIcon brand="github" className={className} />
                    )}
                  >
                    {({ isOpen }) => (
                      <BlockItemButtonLike
                        asElement="button"
                        text={formatRepository(field.state.value)}
                        Icon={({ className, hasChanges }) => (
                          <BrandIcon
                            brand="github"
                            color={hasChanges ? "monochrome" : "brand"}
                            className={className}
                          />
                        )}
                        variant="outline"
                        open={isOpen}
                        onBlur={field.handleBlur}
                        hasChanges={staged.gitRepository !== undefined}
                      />
                    )}
                  </field.AsyncAndSearchableSelect>
                </BlockItemContent>
              </BlockItem>
            )}
          />
        </Block>
      )}
      {showBranch && (
        <Block>
          <form.AppField
            name="branch"
            children={(field) => (
              <BlockItem id={settingsIds.source.branch} className="w-full md:w-full">
                <BlockItemHeader>
                  <BlockItemTitle>Branch</BlockItemTitle>
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
                        Icon={({ className }) => <GitBranchIcon className={className} />}
                        variant="outline"
                        open={isOpen}
                        onBlur={field.handleBlur}
                        isPending={isResolvingBranch}
                        hasChanges={staged.gitBranch !== undefined}
                      />
                    )}
                  </field.AsyncAndSearchableSelect>
                </BlockItemContent>
              </BlockItem>
            )}
          />
        </Block>
      )}
      {showAutoDeploy && (
        <Block>
          <BlockItem id={settingsIds.source.autoDeploy} className="w-full md:w-full">
            <BlockItemHeader>
              <BlockItemTitle>Auto Deploy</BlockItemTitle>
            </BlockItemHeader>
            <BlockItemContent>
              <BlockItemToggle
                text="Auto deploy on push"
                Icon={ZapIcon}
                checked={autoDeploy}
                hasChanges={staged.autoDeploy !== undefined}
                onCheckedChange={(checked) =>
                  stage({
                    field: "autoDeploy",
                    label: "Auto deploy",
                    value: checked,
                    previous: serverAutoDeploy,
                    format: autoDeployLabel,
                  })
                }
              />
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
    </SettingsSection>
  );
}

function autoDeployLabel(value: boolean) {
  return value ? "On" : "Off";
}

function DockerImageSection({ image, tag, service }: TDockerImageSectionProps) {
  const { isItemVisible } = useSettingsSectionSearch("source");
  const queryClient = useQueryClient();
  const serverImage = `${image}:${tag}`;
  const { staged, stage, unstage } = useServiceChanges(service, { image: serverImage });
  const selected = splitImage(stagedString(staged.image, serverImage));
  const selectedIsNonDockerHub = isNonDockerHubImage(selected.image);

  const [imageInputValue, setImageInputValue] = useState("");
  const [imageSearch] = useDebounceValue(imageInputValue, defaultDebounceMs);
  const [tagInputValue, setTagInputValue] = useState("");
  const [tagSearch] = useDebounceValue(tagInputValue, defaultDebounceMs);
  const [isResolvingTag, setIsResolvingTag] = useState(false);
  const resolveCounter = useRef(0);
  const stagedRef = useRef(staged);
  stagedRef.current = staged;

  const defaultValues = { image: selected.image, tag: selected.tag };
  const form = useAppForm({ defaultValues });
  useResetFormOnStagedChange(form, defaultValues, staged, ["image"]);

  const cleanedImageSearch = cleanSearch(imageInputValue ? imageSearch : imageInputValue);
  const typedRegistryImage = isNonDockerHubImage(cleanedImageSearch) ? cleanedImageSearch : null;
  const {
    data: dataImages,
    isPending: isPendingImages,
    error: errorImages,
  } = useQuery({
    ...dockerSearchQuery({ search: cleanedImageSearch }),
    enabled: typedRegistryImage === null,
  });

  const {
    data: dataTags,
    isPending: isPendingTags,
    error: errorTags,
  } = useQuery({
    ...dockerTagsQuery({
      repository: selected.image,
      search: tagInputValue ? tagSearch : tagInputValue,
    }),
    enabled: !selectedIsNonDockerHub,
  });

  const imageItems: TCommandItem[] | undefined = useMemo(() => {
    if (typedRegistryImage !== null) {
      return [{ value: typedRegistryImage, label: typedRegistryImage }];
    }
    return dataImages?.repositories.map((r) => ({
      value: r.repo_name,
      label: r.repo_name,
      description: `${formatKMBT(r.pull_count)} pulls`,
    }));
  }, [dataImages, typedRegistryImage]);

  const tagItems: TCommandItem[] | undefined = useMemo(() => {
    const items: TCommandItem[] | undefined = dataTags?.tags?.map((b) => ({
      value: b.name,
      label: b.name,
    }));
    return items;
  }, [dataTags]);

  const stageImage = (next: string) => {
    form.setFieldValue("tag", splitImage(next).tag);
    stage({ field: "image", label: "Image", value: next, previous: serverImage });
  };

  // An image is staged at once with latest. A Docker Hub image then moves to its newest
  // tag when it has no latest tag. Other registries have no tag list and stay on latest.
  const changeImage = async (next: string) => {
    if (next === image) {
      resolveCounter.current++;
      setIsResolvingTag(false);
      form.setFieldValue("tag", tag);
      unstage(["image"]);
      return;
    }
    stageImage(`${next}:latest`);
    if (isNonDockerHubImage(next)) {
      resolveCounter.current++;
      setIsResolvingTag(false);
      return;
    }

    const request = ++resolveCounter.current;
    setIsResolvingTag(true);
    try {
      const { tags } = await queryClient.fetchQuery(
        dockerTagsQuery({ repository: next, search: "" }),
      );
      if (request !== resolveCounter.current) return;
      if (stagedRef.current.image?.isApplying) return;
      const resolvedTag = tags.find((t) => t.name === "latest")?.name ?? tags[0]?.name;
      if (!resolvedTag) throw new Error("The image has no tags.");
      stageImage(`${next}:${resolvedTag}`);
    } catch (error) {
      if (request !== resolveCounter.current) return;
      unstage(["image"]);
      toast.add({
        type: "error",
        title: "Could not read the image's tags",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        timeout: 5000,
      });
    } finally {
      if (request === resolveCounter.current) setIsResolvingTag(false);
    }
  };

  const showImage = isItemVisible(settingsIds.source.image);
  const showTag = isItemVisible(settingsIds.source.tag);
  if (!showImage && !showTag) return null;

  return (
    <SettingsSection
      title="Source"
      id="source"
      entityId={`source-${service.id}`}
      Icon={CodeIcon}
      classNameContent="gap-5"
      hasChanges={staged.image !== undefined}
      isApplying={hasApplying(staged, ["image"])}
      onDiscard={() => unstage(["image"])}
    >
      {showImage && (
        <Block>
          <form.AppField
            name="image"
            children={(field) => (
              <BlockItem id={settingsIds.source.image} className="w-full md:w-full">
                <BlockItemHeader>
                  <BlockItemTitle>Image</BlockItemTitle>
                  <SuffixExternalLink
                    href={
                      selectedIsNonDockerHub
                        ? `https://${selected.image}`
                        : `https://hub.docker.com/r/${selected.image}`
                    }
                    label={
                      selectedIsNonDockerHub ? "Open image registry" : "Open image on Docker Hub"
                    }
                  />
                </BlockItemHeader>
                <BlockItemContent>
                  <field.AsyncAndSearchableSelect
                    dontCheckUntilSubmit
                    field={field}
                    value={field.state.value}
                    onChange={(v) => {
                      if (!v || v === field.state.value) return;
                      field.handleChange(v);
                      setTagInputValue("");
                      changeImage(v);
                    }}
                    items={imageItems}
                    isPending={typedRegistryImage === null && isPendingImages}
                    error={errorImages?.message}
                    commandInputPlaceholder="Search Docker images..."
                    CommandEmptyText="No images found"
                    CommandEmptyIcon={PackageIcon}
                    commandShouldntFilter={true}
                    commandInputValue={imageInputValue}
                    commandInputValueOnChange={(v) => setImageInputValue(v)}
                  >
                    {({ isOpen }) => (
                      <BlockItemButtonLike
                        asElement="button"
                        text={field.state.value}
                        Icon={({ className, hasChanges }) => {
                          if (isNonDockerHubImage(field.state.value)) {
                            return <PackageIcon className={className} />;
                          }
                          return (
                            <BrandIcon
                              brand="docker"
                              color={hasChanges ? "monochrome" : "brand"}
                              className={className}
                            />
                          );
                        }}
                        variant="outline"
                        open={isOpen}
                        onBlur={field.handleBlur}
                        hasChanges={staged.image !== undefined}
                      />
                    )}
                  </field.AsyncAndSearchableSelect>
                </BlockItemContent>
              </BlockItem>
            )}
          />
        </Block>
      )}
      {showTag && (
        <Block>
          <form.AppField
            name="tag"
            children={(field) => (
              <BlockItem id={settingsIds.source.tag} className="w-full md:w-full">
                <BlockItemHeader>
                  <BlockItemTitle>Tag</BlockItemTitle>
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
                        value: `${selected.image}:${v}`,
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
                    commandInputValue={tagInputValue}
                    commandInputValueOnChange={(v) => setTagInputValue(v)}
                  >
                    {({ isOpen }) => (
                      <BlockItemButtonLike
                        asElement="button"
                        text={field.state.value}
                        Icon={({ className }) => <TagIcon className={className} />}
                        variant="outline"
                        open={isOpen}
                        onBlur={field.handleBlur}
                        isPending={isResolvingTag}
                        disabled={selectedIsNonDockerHub}
                        hideChevron={selectedIsNonDockerHub}
                        fadeOnDisabled={false}
                        hasChanges={staged.image !== undefined}
                      />
                    )}
                  </field.AsyncAndSearchableSelect>
                </BlockItemContent>
              </BlockItem>
            )}
          />
        </Block>
      )}
    </SettingsSection>
  );
}

function DatabaseSection({ type, version, service }: TDatabaseSectionProps) {
  const { isItemVisible } = useSettingsSectionSearch("source");
  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);

  const showDatabase = isItemVisible(settingsIds.source.database);
  const showVersion = isItemVisible(settingsIds.source.version);
  if (!showDatabase && !showVersion) return null;

  return (
    <SettingsSection
      title="Source"
      id="source"
      entityId={sectionHighlightId}
      Icon={CodeIcon}
      classNameContent="gap-5"
    >
      {showDatabase && (
        <Block>
          {/* Database */}
          <BlockItem id={settingsIds.source.database} className="w-full md:w-full">
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
      )}
      {showVersion && (
        <Block>
          {/* Version */}
          <BlockItem id={settingsIds.source.version} className="w-full md:w-full">
            <BlockItemHeader>
              <BlockItemTitle>Version</BlockItemTitle>
            </BlockItemHeader>
            <BlockItemContent>
              <BlockItemButtonLike
                asElement="div"
                text={version}
                Icon={({ className }) => <MilestoneIcon className={className} />}
              />
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
    </SettingsSection>
  );
}

function getEntityId(service: TServiceShallow): string {
  return `source_${service.id}`;
}

// The tag follows the last colon after the last slash, so registries with a port keep theirs
function splitImage(ref: string) {
  const colon = ref.lastIndexOf(":");
  if (colon > ref.lastIndexOf("/")) {
    return { image: ref.slice(0, colon), tag: ref.slice(colon + 1) || "latest" };
  }
  return { image: ref, tag: "latest" };
}

function SuffixExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      className="text-muted-foreground -my-1.5 -mr-0.5 ml-auto size-8 self-end rounded-md"
      render={<a href={href} rel="noreferrer noopener" target="_blank" />}
    >
      <ExternalLink className="size-4.5" />
    </Button>
  );
}
