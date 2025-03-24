import { z } from 'zod';

export const CallbackResponseBodySchema = z
  .object({
    access_token: z.string(),
    expiry: z.string(),
    id_token: z.string(),
    refresh_token: z.string(),
    token_type: z.string(),
  })
  .strict();

export const CreateBuildInputBodySchema = z
  .object({
    environment_id: z.string(),
    project_id: z.string(),
    service_id: z.string(),
    team_id: z.string(),
  })
  .strict();

export const DeploymentStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'cancelled',
  'failed',
]);

export const DeploymentResponseSchema = z
  .object({
    attempts: z.number(),
    completed_at: z.string().optional(),
    created_at: z.string(),
    error: z.string().optional(),
    id: z.string(),
    service_id: z.string(),
    started_at: z.string().optional(),
    status: DeploymentStatusSchema,
    updated_at: z.string(),
  })
  .strict();

export const CreateBuildOutputBodySchema = z
  .object({
    data: DeploymentResponseSchema,
  })
  .strict();

export const CreateProjectInputBodySchema = z
  .object({
    description: z.string().nullable().optional(),
    display_name: z.string(),
    team_id: z.string(),
  })
  .strict();

export const FrameworkSchema = z.enum([
  'next',
  'astro',
  'vite',
  'cra',
  'angular',
  'remix',
  'bun',
  'express',
  'python',
  'django',
  'flask',
  'fastapi',
  'fasthtml',
  'gin',
  'spring-boot',
  'laravel',
  'unknown',
]);

export const ProviderSchema = z.enum([
  'node',
  'deno',
  'go',
  'java',
  'php',
  'python',
  'staticfile',
  'unknown',
]);

export const EnvironmentResponseSchema = z
  .object({
    active: z.boolean(),
    created_at: z.string(),
    description: z.string(),
    display_name: z.string(),
    framework_summary: z.array(FrameworkSchema).optional(),
    id: z.string(),
    name: z.string(),
    provider_summary: z.array(ProviderSchema).optional(),
    service_count: z.number().optional(),
  })
  .strict();

export const ProjectResponseSchema = z
  .object({
    created_at: z.string(),
    description: z.string().nullable(),
    display_name: z.string(),
    environments: z.array(EnvironmentResponseSchema),
    id: z.string(),
    name: z.string(),
    status: z.string(),
    team_id: z.string(),
  })
  .strict();

export const CreateProjectResponseBodySchema = z
  .object({
    data: ProjectResponseSchema,
  })
  .strict();

export const CreateServiceInputSchema = z
  .object({
    auto_deploy: z.boolean().optional(),
    builder: z.string(), // Builder of the service - docker, railpack
    description: z.string().optional(),
    display_name: z.string(),
    environment_id: z.string(),
    git_branch: z.string().optional(),
    github_installation_id: z.number().optional(),
    host: z.string().optional(),
    image: z.string().optional(),
    port: z.number().optional(),
    project_id: z.string(),
    public: z.boolean().optional(),
    replicas: z.number().optional(),
    repository_name: z.string().optional(),
    repository_owner: z.string().optional(),
    run_command: z.string().optional(),
    team_id: z.string(),
    type: z.string(), // Type of service, e.g. 'git', 'docker'
  })
  .strict();

export const ServiceConfigResponseSchema = z
  .object({
    auto_deploy: z.boolean(),
    git_branch: z.string().optional(),
    host: z.string().optional(),
    image: z.string().optional(),
    port: z.number().optional(),
    public: z.boolean(),
    replicas: z.number(),
    run_command: z.string().optional(),
  })
  .strict();

export const ServiceResponseSchema = z
  .object({
    builder: z.string(),
    config: ServiceConfigResponseSchema,
    created_at: z.string(),
    description: z.string(),
    display_name: z.string(),
    environment_id: z.string(),
    framework: FrameworkSchema.optional(),
    git_repository: z.string().optional(),
    github_installation_id: z.number().optional(),
    id: z.string(),
    name: z.string(),
    provider: ProviderSchema.optional(),
    type: z.string(),
    updated_at: z.string(),
  })
  .strict();

export const CreateServiceResponseBodySchema = z
  .object({
    data: ServiceResponseSchema,
  })
  .strict();

export const DataStructSchema = z
  .object({
    deleted: z.boolean(),
    id: z.string(),
  })
  .strict();

export const DeleteProjectInputBodySchema = z
  .object({
    project_id: z.string(),
    team_id: z.string(),
  })
  .strict();

export const DeleteProjectResponseBodySchema = z
  .object({
    data: DataStructSchema,
  })
  .strict();

export const SecretDeleteInputSchema = z
  .object({
    name: z.string(),
  })
  .strict();

export const SecretTypeSchema = z.enum(['team', 'project', 'environment', 'service']);

export const DeleteSecretSecretsInputBodySchema = z
  .object({
    environment_id: z.string().optional(), // If present without service_id, mutate environment secrets - requires project_id
    is_build_secret: z.boolean().optional(),
    project_id: z.string().optional(), // If present without environment_id, mutate team secrets
    secrets: z.array(SecretDeleteInputSchema).nullable(),
    service_id: z.string().optional(), // If present, mutate service secrets - requires project_id and environment_id
    team_id: z.string(),
    type: SecretTypeSchema, // The type of secret
  })
  .strict();

export const PermissionEdgesSchema = z
  .object({
    groups: z
      .array(z.lazy(() => GroupSchema))
      .nullable()
      .optional(),
  })
  .strict();

export const PermissionSchema = z
  .object({
    action: z.string().optional(),
    created_at: z.string().optional(),
    edges: PermissionEdgesSchema,
    id: z.string(),
    labels: z.object({}).optional(),
    resource_id: z.string().optional(),
    resource_type: z.string().optional(),
    scope: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export const GithubInstallationEdgesSchema = z
  .object({
    github_app: z.lazy(() => GithubAppSchema).optional(),
    services: z
      .array(z.lazy(() => ServiceSchema))
      .nullable()
      .optional(),
  })
  .strict();

export const GithubInstallationPermissionsSchema = z
  .object({
    contents: z.string().optional(),
    metadata: z.string().optional(),
  })
  .strict();

export const GithubInstallationSchema = z
  .object({
    account_id: z.number().optional(),
    account_login: z.string().optional(),
    account_type: z.string().optional(),
    account_url: z.string().optional(),
    active: z.boolean().optional(),
    created_at: z.string().optional(),
    edges: GithubInstallationEdgesSchema,
    events: z.array(z.string()).nullable().optional(),
    github_app_id: z.number().optional(),
    id: z.number().optional(),
    permissions: GithubInstallationPermissionsSchema.optional(),
    repository_selection: z.string().optional(),
    suspended: z.boolean().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export const GithubAppEdgesSchema = z
  .object({
    installations: z.array(GithubInstallationSchema).nullable().optional(),
    users: z.lazy(() => UserSchema).optional(),
  })
  .strict();

export const GithubAppSchema: z.ZodType<unknown> = z
  .object({
    client_id: z.string().optional(),
    created_at: z.string().optional(),
    created_by: z.string().optional(),
    edges: GithubAppEdgesSchema,
    id: z.number().optional(),
    name: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export const Oauth2CodeEdgesSchema = z
  .object({
    user: z.lazy(() => UserSchema).optional(),
  })
  .strict();

export const Oauth2CodeSchema = z
  .object({
    client_id: z.string().optional(),
    created_at: z.string().optional(),
    edges: Oauth2CodeEdgesSchema,
    expires_at: z.string().optional(),
    id: z.string(),
    revoked: z.boolean().optional(),
    scope: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export const Oauth2TokenEdgesSchema = z
  .object({
    user: z.lazy(() => UserSchema).optional(),
  })
  .strict();

export const Oauth2TokenSchema = z
  .object({
    client_id: z.string().optional(),
    created_at: z.string().optional(),
    device_info: z.string().optional(),
    edges: Oauth2TokenEdgesSchema,
    expires_at: z.string().optional(),
    id: z.string(),
    revoked: z.boolean().optional(),
    scope: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export const UserEdgesSchema = z
  .object({
    created_by: z.array(GithubAppSchema).nullable().optional(),
    groups: z
      .array(z.lazy(() => GroupSchema))
      .nullable()
      .optional(),
    oauth2_codes: z.array(Oauth2CodeSchema).nullable().optional(),
    oauth2_tokens: z.array(Oauth2TokenSchema).nullable().optional(),
    teams: z
      .array(z.lazy(() => TeamSchema))
      .nullable()
      .optional(),
  })
  .strict();

export const UserSchema: z.ZodType<unknown> = z
  .object({
    created_at: z.string().optional(),
    edges: UserEdgesSchema,
    email: z.string().optional(),
    id: z.string(),
    updated_at: z.string().optional(),
  })
  .strict();

export const GroupEdgesSchema = z
  .object({
    permissions: z.array(PermissionSchema).nullable().optional(),
    team: z.lazy(() => TeamSchema).optional(),
    users: z.array(UserSchema).nullable().optional(),
  })
  .strict();

export const GroupSchema: z.ZodType<unknown> = z
  .object({
    created_at: z.string().optional(),
    description: z.string().optional(),
    edges: GroupEdgesSchema,
    external_id: z.string().optional(),
    id: z.string(),
    identity_provider: z.string().optional(),
    k8s_role_name: z.string().optional(),
    name: z.string().optional(),
    superuser: z.boolean().optional(),
    team_id: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export const TeamEdgesSchema = z
  .object({
    groups: z.array(GroupSchema).nullable().optional(),
    members: z.array(UserSchema).nullable().optional(),
    projects: z
      .array(z.lazy(() => ProjectSchema))
      .nullable()
      .optional(),
  })
  .strict();

export const TeamSchema: z.ZodType<unknown> = z
  .object({
    created_at: z.string().optional(),
    description: z.string().optional(),
    display_name: z.string().optional(),
    edges: TeamEdgesSchema,
    id: z.string(),
    kubernetes_secret: z.string().optional(),
    name: z.string().optional(),
    namespace: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export const ProjectEdgesSchema = z
  .object({
    environments: z
      .array(z.lazy(() => EnvironmentSchema))
      .nullable()
      .optional(),
    team: TeamSchema.optional(),
  })
  .strict();

export const ProjectSchema: z.ZodType<unknown> = z
  .object({
    created_at: z.string().optional(),
    description: z.string().optional(),
    display_name: z.string().optional(),
    edges: ProjectEdgesSchema,
    id: z.string(),
    kubernetes_secret: z.string().optional(),
    name: z.string().optional(),
    status: z.string().optional(),
    team_id: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export const EnvironmentEdgesSchema = z
  .object({
    project: ProjectSchema.optional(),
    services: z
      .array(z.lazy(() => ServiceSchema))
      .nullable()
      .optional(),
  })
  .strict();

export const EnvironmentSchema: z.ZodType<unknown> = z
  .object({
    active: z.boolean().optional(),
    created_at: z.string().optional(),
    description: z.string().optional(),
    display_name: z.string().optional(),
    edges: EnvironmentEdgesSchema,
    id: z.string(),
    kubernetes_secret: z.string().optional(),
    name: z.string().optional(),
    project_id: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export const ServiceConfigEdgesSchema = z
  .object({
    service: z.lazy(() => ServiceSchema).optional(),
  })
  .strict();

export const ServiceConfigSchema = z
  .object({
    auto_deploy: z.boolean().optional(),
    created_at: z.string().optional(),
    edges: ServiceConfigEdgesSchema,
    git_branch: z.string().optional(),
    host: z.string().optional(),
    id: z.string(),
    image: z.string().optional(),
    port: z.number().optional(),
    public: z.boolean().optional(),
    replicas: z.number().optional(),
    run_command: z.string().optional(),
    service_id: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export const ServiceEdgesSchema = z
  .object({
    deployments: z
      .array(z.lazy(() => DeploymentSchema))
      .nullable()
      .optional(),
    environment: EnvironmentSchema.optional(),
    github_installation: GithubInstallationSchema.optional(),
    service_config: ServiceConfigSchema.optional(),
  })
  .strict();

export const ServiceSchema: z.ZodType<unknown> = z
  .object({
    builder: z.string().optional(),
    created_at: z.string().optional(),
    description: z.string().optional(),
    display_name: z.string().optional(),
    edges: ServiceEdgesSchema,
    environment_id: z.string().optional(),
    framework: FrameworkSchema.optional(),
    git_repository: z.string().optional(),
    github_installation_id: z.number().optional(),
    id: z.string(),
    kubernetes_secret: z.string().optional(),
    name: z.string().optional(),
    provider: ProviderSchema.optional(),
    type: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export const DeploymentEdgesSchema = z
  .object({
    service: ServiceSchema.optional(),
  })
  .strict();

export const DeploymentSchema: z.ZodType<unknown> = z
  .object({
    attempts: z.number().optional(),
    completed_at: z.string().optional(),
    created_at: z.string().optional(),
    edges: DeploymentEdgesSchema,
    error: z.string().optional(),
    id: z.string(),
    kubernetes_job_name: z.string().optional(),
    kubernetes_job_status: z.string().optional(),
    service_id: z.string().optional(),
    started_at: z.string().optional(),
    status: DeploymentStatusSchema.optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export const ErrorDetailSchema = z
  .object({
    location: z.string().optional(), // Where the error occurred, e.g. 'body.items[3].tags' or 'path.thing-id'
    message: z.string().optional(), // Error message text
    value: z.any().optional(), // The value at the given location
  })
  .strict();

export const ErrorModelSchema = z
  .object({
    detail: z.string().optional(), // A human-readable explanation specific to this occurrence of the problem.
    errors: z.array(ErrorDetailSchema).nullable().optional(), // Optional list of individual error details
    instance: z.string().optional(), // A URI reference that identifies the specific occurrence of the problem.
    status: z.number().optional(), // HTTP status code
    title: z.string().optional(), // A short, human-readable summary of the problem type. This value should not change between occurrences of the error.
    type: z.string().optional(), // A URI reference to human-readable documentation for the error.
  })
  .strict();

export const GetEnvironmentOutputBodySchema = z
  .object({
    data: EnvironmentResponseSchema,
  })
  .strict();

export const GetProjectResponseBodySchema = z
  .object({
    data: ProjectResponseSchema,
  })
  .strict();

export const GetServiceResponseBodySchema = z
  .object({
    data: ServiceResponseSchema,
  })
  .strict();

export const GetTeamResponseSchema = z
  .object({
    created_at: z.string(),
    description: z.string().nullable(),
    display_name: z.string(),
    id: z.string(),
    name: z.string(),
  })
  .strict();

export const PlanSchema = z
  .object({
    collaborators: z.number().optional(),
    filled_seats: z.number().optional(),
    name: z.string().optional(),
    private_repos: z.number().optional(),
    seats: z.number().optional(),
    space: z.number().optional(),
  })
  .strict();

export const OrganizationSchema = z
  .object({
    advanced_security_enabled_for_new_repositories: z.boolean().optional(),
    avatar_url: z.string().optional(),
    billing_email: z.string().optional(),
    blog: z.string().optional(),
    collaborators: z.number().optional(),
    company: z.string().optional(),
    created_at: z.string().optional(),
    default_repository_permission: z.string().optional(),
    default_repository_settings: z.string().optional(),
    dependabot_alerts_enabled_for_new_repositories: z.boolean().optional(),
    dependabot_security_updates_enabled_for_new_repositories: z.boolean().optional(),
    dependency_graph_enabled_for_new_repositories: z.boolean().optional(),
    description: z.string().optional(),
    disk_usage: z.number().optional(),
    email: z.string().optional(),
    events_url: z.string().optional(),
    followers: z.number().optional(),
    following: z.number().optional(),
    has_organization_projects: z.boolean().optional(),
    has_repository_projects: z.boolean().optional(),
    hooks_url: z.string().optional(),
    html_url: z.string().optional(),
    id: z.number().optional(),
    is_verified: z.boolean().optional(),
    issues_url: z.string().optional(),
    location: z.string().optional(),
    login: z.string().optional(),
    members_allowed_repository_creation_type: z.string().optional(),
    members_can_create_internal_repositories: z.boolean().optional(),
    members_can_create_pages: z.boolean().optional(),
    members_can_create_private_pages: z.boolean().optional(),
    members_can_create_private_repositories: z.boolean().optional(),
    members_can_create_public_pages: z.boolean().optional(),
    members_can_create_public_repositories: z.boolean().optional(),
    members_can_create_repositories: z.boolean().optional(),
    members_can_fork_private_repositories: z.boolean().optional(),
    members_url: z.string().optional(),
    name: z.string().optional(),
    node_id: z.string().optional(),
    owned_private_repos: z.number().optional(),
    plan: PlanSchema.optional(),
    private_gists: z.number().optional(),
    public_gists: z.number().optional(),
    public_members_url: z.string().optional(),
    public_repos: z.number().optional(),
    repos_url: z.string().optional(),
    secret_scanning_enabled_for_new_repositories: z.boolean().optional(),
    secret_scanning_push_protection_enabled_for_new_repositories: z.boolean().optional(),
    secret_scanning_validity_checks_enabled: z.boolean().optional(),
    total_private_repos: z.number().optional(),
    twitter_username: z.string().optional(),
    two_factor_requirement_enabled: z.boolean().optional(),
    type: z.string().optional(),
    updated_at: z.string().optional(),
    url: z.string().optional(),
    web_commit_signoff_required: z.boolean().optional(),
  })
  .strict();

export const GithubAdminOrganizationListResponseBodySchema = z
  .object({
    data: z.array(OrganizationSchema).nullable(),
  })
  .strict();

export const GithubRepositoryOwnerSchema = z
  .object({
    avatar_url: z.string(),
    id: z.number(),
    login: z.string(),
    name: z.string(),
  })
  .strict();

export const GithubRepositorySchema = z
  .object({
    clone_url: z.string(),
    full_name: z.string(),
    homepage: z.string(),
    html_url: z.string(),
    id: z.number(),
    name: z.string(),
    owner: GithubRepositoryOwnerSchema,
    updated_at: z.string(),
  })
  .strict();

export const GithubAdminRepositoryListResponseBodySchema = z
  .object({
    data: z.array(GithubRepositorySchema).nullable(),
  })
  .strict();

export const GithubAppCreateResponseBodySchema = z
  .object({
    data: z.string(),
  })
  .strict();

export const GithubAppInstallationListResponseBodySchema = z
  .object({
    data: z.array(GithubInstallationSchema).nullable(),
  })
  .strict();

export const GithubAppListResponseBodySchema = z
  .object({
    data: z.array(GithubAppSchema).nullable(),
  })
  .strict();

export const GithubBranchSchema = z
  .object({
    name: z.string(),
    protected: z.boolean(),
    ref: z.string(),
    sha: z.string(),
  })
  .strict();

export const GithubTagSchema = z
  .object({
    name: z.string(),
    ref: z.string(),
    sha: z.string(),
  })
  .strict();

export const GithubRepositoryDetailSchema = z
  .object({
    archived: z.boolean(),
    branches: z.array(GithubBranchSchema).nullable(),
    createdAt: z.string(),
    defaultBranch: z.string(),
    description: z.string(),
    disabled: z.boolean(),
    fork: z.boolean(),
    forksCount: z.number(),
    fullName: z.string(),
    htmlUrl: z.string(),
    id: z.number(),
    language: z.string(),
    name: z.string(),
    openIssuesCount: z.number(),
    owner: GithubRepositoryOwnerSchema,
    private: z.boolean(),
    pushedAt: z.string(),
    size: z.number(),
    stargazersCount: z.number(),
    tags: z.array(GithubTagSchema).nullable(),
    updatedAt: z.string(),
    url: z.string(),
    watchersCount: z.number(),
  })
  .strict();

export const GithubRepositoryDetailResponseBodySchema = z
  .object({
    data: GithubRepositoryDetailSchema,
  })
  .strict();

export const HealthResponseBodySchema = z
  .object({
    status: z.string(),
  })
  .strict();

export const ItemSchema = z
  .object({
    name: z.string(),
    value: z.string(),
  })
  .strict();

export const PaginationResponseMetadataSchema = z
  .object({
    has_next: z.boolean(),
    next: z.string().optional(),
    previous: z.string().optional(),
  })
  .strict();

export const ListDeploymentResponseDataSchema = z
  .object({
    jobs: z.array(DeploymentResponseSchema).nullable(),
    metadata: PaginationResponseMetadataSchema,
  })
  .strict();

export const ListDeploymentsResponseBodySchema = z
  .object({
    data: ListDeploymentResponseDataSchema,
  })
  .strict();

export const ListProjectResponseBodySchema = z
  .object({
    data: z.array(ProjectResponseSchema).nullable(),
  })
  .strict();

export const ListServiceResponseBodySchema = z
  .object({
    data: z.array(ServiceResponseSchema).nullable(),
  })
  .strict();

export const LogEventSchema = z
  .object({
    message: z.string(),
    pod_name: z.string(),
    timestamp: z.string().optional(),
  })
  .strict();

export const LogSSEErrorSchema = z
  .object({
    code: z.number(),
    message: z.string(),
  })
  .strict();

export const LogTypeSchema = z.enum(['team', 'project', 'environment', 'service']);

export const MeResponseBodySchema = z
  .object({
    data: UserSchema,
  })
  .strict();

export const SecretResponseSchema = z
  .object({
    name: z.string(),
    type: SecretTypeSchema,
    value: z.string(),
  })
  .strict();

export const SecretsResponseBodySchema = z
  .object({
    data: z.array(SecretResponseSchema),
  })
  .strict();

export const SortByFieldSchema = z.enum(['created_at', 'updated_at']);

export const SortOrderSchema = z.enum(['asc', 'desc']);

export const TeamResponseBodySchema = z
  .object({
    data: z.array(GetTeamResponseSchema).nullable(),
  })
  .strict();

export const UpdatServiceResponseBodySchema = z
  .object({
    data: ServiceResponseSchema,
  })
  .strict();

export const UpdateProjectInputBodySchema = z
  .object({
    description: z.string().nullable().optional(),
    display_name: z.string().optional(),
    project_id: z.string(),
    team_id: z.string(),
  })
  .strict();

export const UpdateProjectResponseBodySchema = z
  .object({
    data: ProjectResponseSchema,
  })
  .strict();

export const UpdateServiceInputSchema = z
  .object({
    auto_deploy: z.boolean().optional(),
    description: z.string().nullable().optional(),
    display_name: z.string().nullable().optional(),
    environment_id: z.string(),
    git_branch: z.string().optional(),
    host: z.string().optional(),
    image: z.string().optional(),
    port: z.number().optional(),
    project_id: z.string(),
    public: z.boolean().optional(),
    replicas: z.number().optional(),
    run_command: z.string().optional(),
    service_id: z.string(),
    team_id: z.string(),
  })
  .strict();

export const UpdateTeamInputBodySchema = z
  .object({
    description: z.string().nullable(),
    display_name: z.string(),
    team_id: z.string(),
  })
  .strict();

export const UpdateTeamResponseBodySchema = z
  .object({
    data: GetTeamResponseSchema,
  })
  .strict();

export const UpsertSecretsInputBodySchema = z
  .object({
    environment_id: z.string().optional(), // If present without service_id, mutate environment secrets - requires project_id
    is_build_secret: z.boolean().optional(),
    project_id: z.string().optional(), // If present without environment_id, mutate team secrets
    secrets: z.array(ItemSchema).nullable(),
    service_id: z.string().optional(), // If present, mutate service secrets - requires project_id and environment_id
    team_id: z.string(),
    type: SecretTypeSchema, // The type of secret
  })
  .strict();

export type CallbackResponseBody = z.infer<typeof CallbackResponseBodySchema>;
export type CreateBuildInputBody = z.infer<typeof CreateBuildInputBodySchema>;
export type DeploymentStatus = z.infer<typeof DeploymentStatusSchema>;
export type DeploymentResponse = z.infer<typeof DeploymentResponseSchema>;
export type CreateBuildOutputBody = z.infer<typeof CreateBuildOutputBodySchema>;
export type CreateProjectInputBody = z.infer<typeof CreateProjectInputBodySchema>;
export type Framework = z.infer<typeof FrameworkSchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type EnvironmentResponse = z.infer<typeof EnvironmentResponseSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type CreateProjectResponseBody = z.infer<typeof CreateProjectResponseBodySchema>;
export type CreateServiceInput = z.infer<typeof CreateServiceInputSchema>;
export type ServiceConfigResponse = z.infer<typeof ServiceConfigResponseSchema>;
export type ServiceResponse = z.infer<typeof ServiceResponseSchema>;
export type CreateServiceResponseBody = z.infer<typeof CreateServiceResponseBodySchema>;
export type DataStruct = z.infer<typeof DataStructSchema>;
export type DeleteProjectInputBody = z.infer<typeof DeleteProjectInputBodySchema>;
export type DeleteProjectResponseBody = z.infer<typeof DeleteProjectResponseBodySchema>;
export type SecretDeleteInput = z.infer<typeof SecretDeleteInputSchema>;
export type SecretType = z.infer<typeof SecretTypeSchema>;
export type DeleteSecretSecretsInputBody = z.infer<typeof DeleteSecretSecretsInputBodySchema>;
export type PermissionEdges = z.infer<typeof PermissionEdgesSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type GithubInstallationEdges = z.infer<typeof GithubInstallationEdgesSchema>;
export type GithubInstallationPermissions = z.infer<typeof GithubInstallationPermissionsSchema>;
export type GithubInstallation = z.infer<typeof GithubInstallationSchema>;
export type GithubAppEdges = z.infer<typeof GithubAppEdgesSchema>;
export type GithubApp = z.infer<typeof GithubAppSchema>;
export type Oauth2CodeEdges = z.infer<typeof Oauth2CodeEdgesSchema>;
export type Oauth2Code = z.infer<typeof Oauth2CodeSchema>;
export type Oauth2TokenEdges = z.infer<typeof Oauth2TokenEdgesSchema>;
export type Oauth2Token = z.infer<typeof Oauth2TokenSchema>;
export type UserEdges = z.infer<typeof UserEdgesSchema>;
export type User = z.infer<typeof UserSchema>;
export type GroupEdges = z.infer<typeof GroupEdgesSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type TeamEdges = z.infer<typeof TeamEdgesSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type ProjectEdges = z.infer<typeof ProjectEdgesSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type EnvironmentEdges = z.infer<typeof EnvironmentEdgesSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
export type ServiceConfigEdges = z.infer<typeof ServiceConfigEdgesSchema>;
export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;
export type ServiceEdges = z.infer<typeof ServiceEdgesSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type DeploymentEdges = z.infer<typeof DeploymentEdgesSchema>;
export type Deployment = z.infer<typeof DeploymentSchema>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type ErrorModel = z.infer<typeof ErrorModelSchema>;
export type GetEnvironmentOutputBody = z.infer<typeof GetEnvironmentOutputBodySchema>;
export type GetProjectResponseBody = z.infer<typeof GetProjectResponseBodySchema>;
export type GetServiceResponseBody = z.infer<typeof GetServiceResponseBodySchema>;
export type GetTeamResponse = z.infer<typeof GetTeamResponseSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type GithubAdminOrganizationListResponseBody = z.infer<
  typeof GithubAdminOrganizationListResponseBodySchema
>;
export type GithubRepositoryOwner = z.infer<typeof GithubRepositoryOwnerSchema>;
export type GithubRepository = z.infer<typeof GithubRepositorySchema>;
export type GithubAdminRepositoryListResponseBody = z.infer<
  typeof GithubAdminRepositoryListResponseBodySchema
>;
export type GithubAppCreateResponseBody = z.infer<typeof GithubAppCreateResponseBodySchema>;
export type GithubAppInstallationListResponseBody = z.infer<
  typeof GithubAppInstallationListResponseBodySchema
>;
export type GithubAppListResponseBody = z.infer<typeof GithubAppListResponseBodySchema>;
export type GithubBranch = z.infer<typeof GithubBranchSchema>;
export type GithubTag = z.infer<typeof GithubTagSchema>;
export type GithubRepositoryDetail = z.infer<typeof GithubRepositoryDetailSchema>;
export type GithubRepositoryDetailResponseBody = z.infer<
  typeof GithubRepositoryDetailResponseBodySchema
>;
export type HealthResponseBody = z.infer<typeof HealthResponseBodySchema>;
export type Item = z.infer<typeof ItemSchema>;
export type PaginationResponseMetadata = z.infer<typeof PaginationResponseMetadataSchema>;
export type ListDeploymentResponseData = z.infer<typeof ListDeploymentResponseDataSchema>;
export type ListDeploymentsResponseBody = z.infer<typeof ListDeploymentsResponseBodySchema>;
export type ListProjectResponseBody = z.infer<typeof ListProjectResponseBodySchema>;
export type ListServiceResponseBody = z.infer<typeof ListServiceResponseBodySchema>;
export type LogEvent = z.infer<typeof LogEventSchema>;
export type LogSSEError = z.infer<typeof LogSSEErrorSchema>;
export type LogType = z.infer<typeof LogTypeSchema>;
export type MeResponseBody = z.infer<typeof MeResponseBodySchema>;
export type SecretResponse = z.infer<typeof SecretResponseSchema>;
export type SecretsResponseBody = z.infer<typeof SecretsResponseBodySchema>;
export type SortByField = z.infer<typeof SortByFieldSchema>;
export type SortOrder = z.infer<typeof SortOrderSchema>;
export type TeamResponseBody = z.infer<typeof TeamResponseBodySchema>;
export type UpdatServiceResponseBody = z.infer<typeof UpdatServiceResponseBodySchema>;
export type UpdateProjectInputBody = z.infer<typeof UpdateProjectInputBodySchema>;
export type UpdateProjectResponseBody = z.infer<typeof UpdateProjectResponseBodySchema>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceInputSchema>;
export type UpdateTeamInputBody = z.infer<typeof UpdateTeamInputBodySchema>;
export type UpdateTeamResponseBody = z.infer<typeof UpdateTeamResponseBodySchema>;
export type UpsertSecretsInputBody = z.infer<typeof UpsertSecretsInputBodySchema>;

export const callbackQuerySchema = z.object({
  code: z.string(),
});

export const list_deploymentsQuerySchema = z.object({
  cursor: z.string().optional(),
  status: DeploymentStatusSchema.optional(), // Filter by status
  id: z.string(), // The ID of the build
  team_id: z.string(), // The ID of the team
  project_id: z.string(), // The ID of the project
  environment_id: z.string(), // The ID of the environment
  service_id: z.string(), // The ID of the service
});

export const get_environmentQuerySchema = z.object({
  id: z.string(),
  team_id: z.string(),
  project_id: z.string(),
});

export const app_createQuerySchema = z.object({
  redirect_url: z.string(), // The client URL to redirect to after the installation is finished
  organization: z.string().optional(), // The organization to install the app for, if any
});

export const list_appsQuerySchema = z.object({
  with_installations: z.boolean().optional(),
});

export const repo_detailQuerySchema = z.object({
  installation_id: z.number(),
  owner: z.string(),
  repo_name: z.string(),
});

export const stream_logsQuerySchema = z.object({
  type: LogTypeSchema,
  team_id: z.string(),
  project_id: z.string().optional(),
  environment_id: z.string().optional(),
  service_id: z.string().optional(),
  since: z.string().optional(), // Duration to look back (e.g., '1h', '30m')
  tail: z.number().optional(), // Number of lines to get from the end
  previous: z.boolean().optional(), // Get logs from previous instance
  timestamps: z.boolean().optional(), // Include timestamps in logs
  search: z.string().optional(), // Optional text pattern to filter logs
});

export const get_projectQuerySchema = z.object({
  project_id: z.string(),
  team_id: z.string(),
});

export const list_projectsQuerySchema = z.object({
  sort_by: SortByFieldSchema.optional(),
  sort_order: SortOrderSchema.optional(),
  team_id: z.string(),
});

export const list_secretsQuerySchema = z.object({
  type: SecretTypeSchema, // The type of secret
  team_id: z.string(),
  project_id: z.string().optional(), // If present, fetch project secrets
  environment_id: z.string().optional(), // If present, fetch environment secrets - requires project_id
  service_id: z.string().optional(), // If present, fetch service secrets - requires project_id and environment_id
});

export const get_serviceQuerySchema = z.object({
  service_id: z.string(),
  team_id: z.string(),
  project_id: z.string(),
  environment_id: z.string(),
});

export const list_serviceQuerySchema = z.object({
  team_id: z.string(),
  project_id: z.string(),
  environment_id: z.string(),
});

export const app_saveQuerySchema = z.object({
  code: z.string(),
  state: z.string(),
});

export type ClientOptions = {
  accessToken: string;
  apiUrl: string;
};

export function createClient({ accessToken, apiUrl }: ClientOptions) {
  return {
    auth: {
      callback: async (
        params: z.infer<typeof callbackQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<CallbackResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/auth/callback`);
          const validatedQuery = callbackQuerySchema.parse(params);
          const queryKeys = ['code'];
          queryKeys.forEach((key) => {
            const value = (validatedQuery as Record<string, string | number | boolean>)[key];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };

          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return CallbackResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      login: async (params?: undefined, fetchOptions?: RequestInit) => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/auth/login`);

          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };

          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return data;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    deployments: {
      create: async (
        params: CreateBuildInputBody,
        fetchOptions?: RequestInit,
      ): Promise<CreateBuildOutputBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/deployments/create`);

          const options: RequestInit = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = CreateBuildInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return CreateBuildOutputBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      list: async (
        params: z.infer<typeof list_deploymentsQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<ListDeploymentsResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/deployments/list`);
          const validatedQuery = list_deploymentsQuerySchema.parse(params);
          const queryKeys = [
            'cursor',
            'status',
            'id',
            'team_id',
            'project_id',
            'environment_id',
            'service_id',
          ];
          queryKeys.forEach((key) => {
            const value = (validatedQuery as Record<string, string | number | boolean>)[key];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };

          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return ListDeploymentsResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    environments: {
      get: async (
        params: z.infer<typeof get_environmentQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetEnvironmentOutputBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/environments/get`);
          const validatedQuery = get_environmentQuerySchema.parse(params);
          const queryKeys = ['id', 'team_id', 'project_id'];
          queryKeys.forEach((key) => {
            const value = (validatedQuery as Record<string, string | number | boolean>)[key];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };

          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return GetEnvironmentOutputBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    github: {
      app: {
        create: async (
          params: z.infer<typeof app_createQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<GithubAppCreateResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/github/app/create`);
            const validatedQuery = app_createQuerySchema.parse(params);
            const queryKeys = ['redirect_url', 'organization'];
            queryKeys.forEach((key) => {
              const value = (validatedQuery as Record<string, string | number | boolean>)[key];
              if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
              }
            });
            const options: RequestInit = {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };

            const response = await fetch(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              throw new Error(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
            }
            const data = await response.json();
            return GithubAppCreateResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
      },
      apps: async (
        params: z.infer<typeof list_appsQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GithubAppListResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/github/apps`);
          const validatedQuery = list_appsQuerySchema.parse(params);
          const queryKeys = ['with_installations'];
          queryKeys.forEach((key) => {
            const value = (validatedQuery as Record<string, string | number | boolean>)[key];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };

          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return GithubAppListResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      installation: {
        installationId: (installationId: string | number | boolean) => ({
          organizations: async (
            params?: undefined,
            fetchOptions?: RequestInit,
          ): Promise<GithubAdminOrganizationListResponseBody> => {
            try {
              if (!apiUrl || typeof apiUrl !== 'string') {
                throw new Error('API URL is undefined or not a string');
              }
              const url = new URL(`${apiUrl}/github/installation/${installationId}/organizations`);

              const options: RequestInit = {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${accessToken}`,
                },
                ...fetchOptions,
              };

              const response = await fetch(url.toString(), options);
              if (!response.ok) {
                console.log(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
                const data = await response.json();
                console.log(`GO API request error`, data);
                console.log(`Request URL is:`, url.toString());

                throw new Error(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
              }
              const data = await response.json();
              return GithubAdminOrganizationListResponseBodySchema.parse(data);
            } catch (error) {
              console.error('Error in API request:', error);
              throw error;
            }
          },
        }),
      },
      installations: async (
        params?: undefined,
        fetchOptions?: RequestInit,
      ): Promise<GithubAppInstallationListResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/github/installations`);

          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };

          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return GithubAppInstallationListResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      repositories: Object.assign(
        async (
          params?: undefined,
          fetchOptions?: RequestInit,
        ): Promise<GithubAdminRepositoryListResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/github/repositories`);

            const options: RequestInit = {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };

            const response = await fetch(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              throw new Error(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
            }
            const data = await response.json();
            return GithubAdminRepositoryListResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        {
          info: async (
            params: z.infer<typeof repo_detailQuerySchema>,
            fetchOptions?: RequestInit,
          ): Promise<GithubRepositoryDetailResponseBody> => {
            try {
              if (!apiUrl || typeof apiUrl !== 'string') {
                throw new Error('API URL is undefined or not a string');
              }
              const url = new URL(`${apiUrl}/github/repositories/info`);
              const validatedQuery = repo_detailQuerySchema.parse(params);
              const queryKeys = ['installation_id', 'owner', 'repo_name'];
              queryKeys.forEach((key) => {
                const value = (validatedQuery as Record<string, string | number | boolean>)[key];
                if (value !== undefined && value !== null) {
                  url.searchParams.append(key, String(value));
                }
              });
              const options: RequestInit = {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${accessToken}`,
                },
                ...fetchOptions,
              };

              const response = await fetch(url.toString(), options);
              if (!response.ok) {
                console.log(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
                const data = await response.json();
                console.log(`GO API request error`, data);
                console.log(`Request URL is:`, url.toString());

                throw new Error(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
              }
              const data = await response.json();
              return GithubRepositoryDetailResponseBodySchema.parse(data);
            } catch (error) {
              console.error('Error in API request:', error);
              throw error;
            }
          },
        },
      ),
    },
    health: async (params?: undefined, fetchOptions?: RequestInit): Promise<HealthResponseBody> => {
      try {
        if (!apiUrl || typeof apiUrl !== 'string') {
          throw new Error('API URL is undefined or not a string');
        }
        const url = new URL(`${apiUrl}/health`);

        const options: RequestInit = {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          ...fetchOptions,
        };

        const response = await fetch(url.toString(), options);
        if (!response.ok) {
          console.log(
            `GO API request failed with status ${response.status}: ${response.statusText}`,
          );
          const data = await response.json();
          console.log(`GO API request error`, data);
          console.log(`Request URL is:`, url.toString());

          throw new Error(
            `GO API request failed with status ${response.status}: ${response.statusText}`,
          );
        }
        const data = await response.json();
        return HealthResponseBodySchema.parse(data);
      } catch (error) {
        console.error('Error in API request:', error);
        throw error;
      }
    },
    logs: {
      stream: async (
        params: z.infer<typeof stream_logsQuerySchema>,
        fetchOptions?: RequestInit,
      ) => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/logs/stream`);
          const validatedQuery = stream_logsQuerySchema.parse(params);
          const queryKeys = [
            'type',
            'team_id',
            'project_id',
            'environment_id',
            'service_id',
            'since',
            'tail',
            'previous',
            'timestamps',
            'search',
          ];
          queryKeys.forEach((key) => {
            const value = (validatedQuery as Record<string, string | number | boolean>)[key];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };

          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return data;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    projects: {
      create: async (
        params: CreateProjectInputBody,
        fetchOptions?: RequestInit,
      ): Promise<CreateProjectResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/projects/create`);

          const options: RequestInit = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = CreateProjectInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return CreateProjectResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      delete: async (
        params: DeleteProjectInputBody,
        fetchOptions?: RequestInit,
      ): Promise<DeleteProjectResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/projects/delete`);

          const options: RequestInit = {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = DeleteProjectInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return DeleteProjectResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      get: async (
        params: z.infer<typeof get_projectQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetProjectResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/projects/get`);
          const validatedQuery = get_projectQuerySchema.parse(params);
          const queryKeys = ['project_id', 'team_id'];
          queryKeys.forEach((key) => {
            const value = (validatedQuery as Record<string, string | number | boolean>)[key];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };

          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return GetProjectResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      list: async (
        params: z.infer<typeof list_projectsQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<ListProjectResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/projects/list`);
          const validatedQuery = list_projectsQuerySchema.parse(params);
          const queryKeys = ['sort_by', 'sort_order', 'team_id'];
          queryKeys.forEach((key) => {
            const value = (validatedQuery as Record<string, string | number | boolean>)[key];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };

          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return ListProjectResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      update: async (
        params: UpdateProjectInputBody,
        fetchOptions?: RequestInit,
      ): Promise<UpdateProjectResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/projects/update`);

          const options: RequestInit = {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = UpdateProjectInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return UpdateProjectResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    secrets: {
      delete: async (
        params: DeleteSecretSecretsInputBody,
        fetchOptions?: RequestInit,
      ): Promise<SecretsResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/secrets/delete`);

          const options: RequestInit = {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = DeleteSecretSecretsInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return SecretsResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      list: async (
        params: z.infer<typeof list_secretsQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<SecretsResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/secrets/list`);
          const validatedQuery = list_secretsQuerySchema.parse(params);
          const queryKeys = ['type', 'team_id', 'project_id', 'environment_id', 'service_id'];
          queryKeys.forEach((key) => {
            const value = (validatedQuery as Record<string, string | number | boolean>)[key];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };

          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return SecretsResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      upsert: async (
        params: UpsertSecretsInputBody,
        fetchOptions?: RequestInit,
      ): Promise<SecretsResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/secrets/upsert`);

          const options: RequestInit = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = UpsertSecretsInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return SecretsResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    services: {
      create: async (
        params: CreateServiceInput,
        fetchOptions?: RequestInit,
      ): Promise<CreateServiceResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/services/create`);

          const options: RequestInit = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = CreateServiceInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return CreateServiceResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      get: async (
        params: z.infer<typeof get_serviceQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetServiceResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/services/get`);
          const validatedQuery = get_serviceQuerySchema.parse(params);
          const queryKeys = ['service_id', 'team_id', 'project_id', 'environment_id'];
          queryKeys.forEach((key) => {
            const value = (validatedQuery as Record<string, string | number | boolean>)[key];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };

          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return GetServiceResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      list: async (
        params: z.infer<typeof list_serviceQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<ListServiceResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/services/list`);
          const validatedQuery = list_serviceQuerySchema.parse(params);
          const queryKeys = ['team_id', 'project_id', 'environment_id'];
          queryKeys.forEach((key) => {
            const value = (validatedQuery as Record<string, string | number | boolean>)[key];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };

          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return ListServiceResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      update: async (
        params: UpdateServiceInput,
        fetchOptions?: RequestInit,
      ): Promise<UpdatServiceResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/services/update`);

          const options: RequestInit = {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = UpdateServiceInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return UpdatServiceResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    teams: {
      list: async (params?: undefined, fetchOptions?: RequestInit): Promise<TeamResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/teams/list`);

          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };

          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return TeamResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      update: async (
        params: UpdateTeamInputBody,
        fetchOptions?: RequestInit,
      ): Promise<UpdateTeamResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/teams/update`);

          const options: RequestInit = {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = UpdateTeamInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return UpdateTeamResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    users: {
      me: async (params?: undefined, fetchOptions?: RequestInit): Promise<MeResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/users/me`);

          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };

          const response = await fetch(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            throw new Error(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
          }
          const data = await response.json();
          return MeResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    webhook: {
      github: Object.assign(
        async (params?: undefined, fetchOptions?: RequestInit) => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/webhook/github`);

            const options: RequestInit = {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };

            const response = await fetch(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              throw new Error(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
            }
            const data = await response.json();
            return data;
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        {
          app: {
            save: async (
              params: z.infer<typeof app_saveQuerySchema>,
              fetchOptions?: RequestInit,
            ) => {
              try {
                if (!apiUrl || typeof apiUrl !== 'string') {
                  throw new Error('API URL is undefined or not a string');
                }
                const url = new URL(`${apiUrl}/webhook/github/app/save`);
                const validatedQuery = app_saveQuerySchema.parse(params);
                const queryKeys = ['code', 'state'];
                queryKeys.forEach((key) => {
                  const value = (validatedQuery as Record<string, string | number | boolean>)[key];
                  if (value !== undefined && value !== null) {
                    url.searchParams.append(key, String(value));
                  }
                });
                const options: RequestInit = {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                  },
                  ...fetchOptions,
                };

                const response = await fetch(url.toString(), options);
                if (!response.ok) {
                  console.log(
                    `GO API request failed with status ${response.status}: ${response.statusText}`,
                  );
                  const data = await response.json();
                  console.log(`GO API request error`, data);
                  console.log(`Request URL is:`, url.toString());

                  throw new Error(
                    `GO API request failed with status ${response.status}: ${response.statusText}`,
                  );
                }
                const data = await response.json();
                return data;
              } catch (error) {
                console.error('Error in API request:', error);
                throw error;
              }
            },
          },
        },
      ),
    },
  };
}
