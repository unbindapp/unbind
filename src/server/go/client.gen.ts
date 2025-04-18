import { z } from 'zod';

export const VariableReferenceSourceTypeSchema = z.enum([
  'team',
  'project',
  'environment',
  'service',
]);

export const VariableReferenceTypeSchema = z.enum([
  'variable',
  'external_endpoint',
  'internal_endpoint',
]);

export const AvailableVariableReferenceSchema = z
  .object({
    keys: z.array(z.string()).nullable(),
    name: z.string(),
    source_id: z.string(),
    source_type: VariableReferenceSourceTypeSchema,
    type: VariableReferenceTypeSchema,
  })
  .strip();

export const AvailableVariableReferenceResponseSchema = z
  .object({
    external_endpoints: z.array(AvailableVariableReferenceSchema),
    internal_endpoints: z.array(AvailableVariableReferenceSchema),
    variables: z.array(AvailableVariableReferenceSchema),
  })
  .strip();

export const BuildkitSettingsResponseSchema = z
  .object({
    max_parallelism: z.number(), // buildkitd max_parallelism setting
    replicas: z.number(), // The number of buildkitd replicas, higher will allow faster concurrent builds
  })
  .strip();

export const BuildkitSettingsUpdateInputBodySchema = z
  .object({
    max_parallelism: z.number(),
    replicas: z.number(),
  })
  .strip();

export const BuildkitSettingsUpdateResponseBodySchema = z
  .object({
    settings: BuildkitSettingsResponseSchema,
  })
  .strip();

export const CallbackResponseBodySchema = z
  .object({
    access_token: z.string(),
    expiry: z.string().datetime(),
    id_token: z.string(),
    refresh_token: z.string(),
    token_type: z.string(),
  })
  .strip();

export const ContainerStateSchema = z.enum(['Running', 'Waiting', 'Terminated']);

export const ContainerStatusSchema = z
  .object({
    crashLoopReason: z.string().optional(),
    isCrashing: z.boolean(),
    lastExitCode: z.number().optional(),
    lastTermination: z.string().optional(),
    name: z.string(),
    ready: z.boolean(),
    restartCount: z.number(),
    state: ContainerStateSchema,
    stateMessage: z.string().optional(),
    stateReason: z.string().optional(),
  })
  .strip();

export const CreateBuildInputBodySchema = z
  .object({
    environment_id: z.string(),
    project_id: z.string(),
    service_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const GitCommitterSchema = z
  .object({
    avatar_url: z.string(),
    name: z.string(),
  })
  .strip();

export const DeploymentStatusSchema = z.enum([
  'queued',
  'building',
  'succeeded',
  'cancelled',
  'failed',
]);

export const DeploymentResponseSchema = z
  .object({
    attempts: z.number(),
    commit_author: GitCommitterSchema.optional(),
    commit_message: z.string().optional(),
    commit_sha: z.string().optional(),
    completed_at: z.string().datetime().optional(),
    created_at: z.string().datetime(),
    error: z.string().optional(),
    id: z.string(),
    image: z.string().optional(),
    job_name: z.string(),
    service_id: z.string(),
    started_at: z.string().datetime().optional(),
    status: DeploymentStatusSchema,
    updated_at: z.string().datetime(),
  })
  .strip();

export const CreateBuildOutputBodySchema = z
  .object({
    data: DeploymentResponseSchema,
  })
  .strip();

export const CreateEnvironmentInputSchema = z
  .object({
    description: z.string().nullable(),
    display_name: z.string(),
    project_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const EnvironmentResponseSchema = z
  .object({
    active: z.boolean(),
    created_at: z.string().datetime(),
    description: z.string(),
    display_name: z.string(),
    id: z.string(),
    name: z.string(),
    service_count: z.number().optional(),
    service_icons: z.array(z.string()).optional(),
  })
  .strip();

export const CreateEnvironmentResponseBodySchema = z
  .object({
    data: EnvironmentResponseSchema,
  })
  .strip();

export const CreateProjectInputBodySchema = z
  .object({
    description: z.string().nullable().optional(),
    display_name: z.string(),
    team_id: z.string(),
  })
  .strip();

export const ProjectResponseSchema = z
  .object({
    created_at: z.string().datetime(),
    default_environment_id: z.string().optional(),
    description: z.string().nullable(),
    display_name: z.string(),
    environment_count: z.number(),
    environments: z.array(EnvironmentResponseSchema),
    id: z.string(),
    name: z.string(),
    service_count: z.number().optional(),
    service_icons: z.array(z.string()).optional(),
    status: z.string(),
    team_id: z.string(),
  })
  .strip();

export const CreateProjectResponseBodySchema = z
  .object({
    data: ProjectResponseSchema,
  })
  .strip();

export const ServiceBuilderSchema = z.enum(['railpack', 'docker', 'database']);

export const HostSpecSchema = z
  .object({
    host: z.string(),
    path: z.string(),
    port: z.number().optional(),
  })
  .strip();

export const ProtocolSchema = z.enum(['TCP', 'UDP', 'SCTP']);

export const PortSpecSchema = z
  .object({
    port: z.number(),
    protocol: ProtocolSchema.optional(),
  })
  .strip();

export const ServiceTypeSchema = z.enum(['github', 'docker-image', 'database']);

export const CreateServiceInputSchema = z
  .object({
    auto_deploy: z.boolean().optional(),
    builder: ServiceBuilderSchema, // Builder of the service - docker, nixpacks, railpack
    database_config: z.record(z.any()).optional(),
    database_type: z.string().optional(),
    description: z.string().optional(),
    display_name: z.string(),
    dockerfile_context: z.string().optional(), // Optional path to Dockerfile context, if using docker builder
    dockerfile_path: z.string().optional(), // Optional path to Dockerfile, if using docker builder
    environment_id: z.string(),
    github_installation_id: z.number().optional(),
    hosts: z.array(HostSpecSchema).nullable().optional(),
    image: z.string().optional(),
    ports: z.array(PortSpecSchema).nullable().optional(),
    project_id: z.string(),
    public: z.boolean().optional(),
    replicas: z.number().optional(),
    repository_name: z.string().optional(),
    repository_owner: z.string().optional(),
    run_command: z.string().optional(),
    team_id: z.string(),
    type: ServiceTypeSchema, // Type of service, e.g. 'github', 'docker-image'
  })
  .strip();

export const ServiceConfigResponseSchema = z
  .object({
    auto_deploy: z.boolean(),
    builder: ServiceBuilderSchema,
    database_type: z.string().optional(),
    database_version: z.string().optional(),
    git_branch: z.string().optional(),
    hosts: z.array(HostSpecSchema).optional(),
    icon: z.string(),
    image: z.string().optional(),
    ports: z.array(PortSpecSchema).optional(),
    public: z.boolean(),
    replicas: z.number(),
    run_command: z.string().optional(),
    type: ServiceTypeSchema,
  })
  .strip();

export const ServiceResponseSchema = z
  .object({
    config: ServiceConfigResponseSchema,
    created_at: z.string().datetime(),
    current_deployment: DeploymentResponseSchema.optional(),
    description: z.string(),
    display_name: z.string(),
    environment_id: z.string(),
    git_repository: z.string().optional(),
    git_repository_owner: z.string().optional(),
    github_installation_id: z.number().optional(),
    id: z.string(),
    last_deployment: DeploymentResponseSchema.optional(),
    last_successful_deployment: DeploymentResponseSchema.optional(),
    name: z.string(),
    updated_at: z.string().datetime(),
  })
  .strip();

export const CreateServiceResponseBodySchema = z
  .object({
    data: ServiceResponseSchema,
  })
  .strip();

export const VariableReferenceSourceSchema = z
  .object({
    id: z.string(),
    key: z.string(),
    name: z.string(),
    source_type: VariableReferenceSourceTypeSchema,
    type: VariableReferenceTypeSchema,
  })
  .strip();

export const CreateVariableReferenceInputSchema = z
  .object({
    sources: z.array(VariableReferenceSourceSchema), // The sources to reference in the template interpolation
    target_name: z.string(), // The name of the target variable
    target_service_id: z.string(), // The ID of the service to which this variable reference belongs
    value_template: z.string(), // The template for the value of the variable reference, e.g. 'https://${sourcename.sourcekey}'
  })
  .strip();

export const VariableReferenceResponseSchema = z
  .object({
    created_at: z.string().datetime(),
    id: z.string(), // The ID of the variable reference
    sources: z.array(VariableReferenceSourceSchema),
    target_name: z.string(),
    target_service_id: z.string(),
    value_template: z.string(),
  })
  .strip();

export const CreateVariableReferenceResponseBodySchema = z
  .object({
    data: VariableReferenceResponseSchema,
  })
  .strip();

export const WebhookTeamEventSchema = z.enum([
  'project.created',
  'project.updated',
  'project.deleted',
]);

export const WebhookProjectEventSchema = z.enum([
  'service.created',
  'service.updated',
  'service.deleted',
  'deployment.queued',
  'deployment.building',
  'deployment.succeeded',
  'deployment.failed',
  'deployment.cancelled',
]);

export const WebhookTypeSchema = z.enum(['team', 'project']);

export const WebhookResponseSchema = z
  .object({
    created_at: z.string().datetime(),
    events: z.array(z.any()),
    id: z.string(),
    project_id: z.string().optional(),
    team_id: z.string(),
    type: WebhookTypeSchema,
    url: z.string(),
  })
  .strip();

export const CreateWebhookResponseBodySchema = z
  .object({
    data: WebhookResponseSchema,
  })
  .strip();

export const DataStructSchema = z
  .object({
    deleted: z.boolean(),
    id: z.string(),
  })
  .strip();

export const DatabaseListSchema = z
  .object({
    databases: z.array(z.string()).nullable(),
  })
  .strip();

export const ParameterPropertySchema: z.ZodType<unknown> = z
  .object({
    $ref: z.string().optional(),
    additionalProperties: z.lazy(() => ParameterPropertySchema).optional(),
    default: z.any().optional(),
    description: z.string().optional(),
    enum: z.array(z.string()).nullable().optional(),
    maximum: z.number().optional(),
    minimum: z.number().optional(),
    properties: z.record(z.lazy(() => ParameterPropertySchema)).optional(),
    type: z.string(),
  })
  .strip();

export const DefinitionParameterSchemaSchema = z
  .object({
    properties: z.record(ParameterPropertySchema),
    required: z.array(z.string()).nullable().optional(),
  })
  .strip();

export const DefinitionSchema = z
  .object({
    category: z.string(),
    description: z.string(),
    name: z.string(),
    port: z.number(),
    schema: DefinitionParameterSchemaSchema,
    type: z.string(),
    version: z.string(),
  })
  .strip();

export const DeleteEnvironmentInputBodySchema = z
  .object({
    environment_id: z.string(),
    project_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const DeleteEnvironmentResponseBodySchema = z
  .object({
    data: DataStructSchema,
  })
  .strip();

export const DeleteProjectInputBodySchema = z
  .object({
    project_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const DeleteProjectResponseBodySchema = z
  .object({
    data: DataStructSchema,
  })
  .strip();

export const DeleteServiceInputBodySchema = z
  .object({
    environment_id: z.string(),
    project_id: z.string(),
    service_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const DeleteServiceResponseBodySchema = z
  .object({
    data: DataStructSchema,
  })
  .strip();

export const VariableDeleteInputSchema = z
  .object({
    name: z.string(),
  })
  .strip();

export const DeleteVariablesInputBodySchema = z
  .object({
    environment_id: z.string().optional(), // If present without service_id, mutate environment variables - requires project_id
    project_id: z.string().optional(), // If present without environment_id, mutate team variables
    service_id: z.string().optional(), // If present, mutate service variables - requires project_id and environment_id
    team_id: z.string(),
    type: VariableReferenceSourceTypeSchema, // The type of variable
    variables: z.array(VariableDeleteInputSchema).nullable(),
  })
  .strip();

export const DeleteWebhookInputBodySchema = z
  .object({
    id: z.string(),
    project_id: z.string().optional(),
    team_id: z.string(),
    type: WebhookTypeSchema,
  })
  .strip();

export const DeleteWebhookResponseBodySchema = z
  .object({
    data: DataStructSchema,
  })
  .strip();

export const ExtendedHostSpecSchema = z
  .object({
    host: z.string(),
    issued: z.boolean(),
    path: z.string(),
    port: z.number().optional(),
  })
  .strip();

export const IngressEndpointSchema = z
  .object({
    environment_id: z.string(),
    hosts: z.array(ExtendedHostSpecSchema),
    name: z.string(),
    project_id: z.string(),
    service_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const ServiceEndpointSchema = z
  .object({
    dns: z.string(),
    environment_id: z.string(),
    name: z.string(),
    ports: z.array(PortSpecSchema),
    project_id: z.string(),
    service_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const EndpointDiscoverySchema = z
  .object({
    external: z.array(IngressEndpointSchema),
    internal: z.array(ServiceEndpointSchema),
  })
  .strip();

export const ErrorDetailSchema = z
  .object({
    location: z.string().optional(), // Where the error occurred, e.g. 'body.items[3].tags' or 'path.thing-id'
    message: z.string().optional(), // Error message text
    value: z.any().optional(), // The value at the given location
  })
  .strip();

export const ErrorModelSchema = z
  .object({
    detail: z.string().optional(), // A human-readable explanation specific to this occurrence of the problem.
    errors: z.array(ErrorDetailSchema).nullable().optional(), // Optional list of individual error details
    instance: z.string().optional(), // A URI reference that identifies the specific occurrence of the problem.
    status: z.number().optional(), // HTTP status code
    title: z.string().optional(), // A short, human-readable summary of the problem type. This value should not change between occurrences of the error.
    type: z.string().optional(), // A URI reference to human-readable documentation for the error.
  })
  .strip();

export const GetDatabaseResponseBodySchema = z
  .object({
    data: DefinitionSchema,
  })
  .strip();

export const GetDeploymentResponseBodySchema = z
  .object({
    data: DeploymentResponseSchema,
  })
  .strip();

export const GetEnvironmentOutputBodySchema = z
  .object({
    data: EnvironmentResponseSchema,
  })
  .strip();

export const MetricsTypeSchema = z.enum(['team', 'project', 'environment', 'service']);

export const MetricDetailSchema = z
  .object({
    breakdown: z.record(z.number().nullable()), // Map of IDs to their respective values
    timestamp: z.string().datetime(),
    value: z.number(), // Aggregated value for the timestamp
  })
  .strip();

export const MetricsMapEntrySchema = z
  .object({
    cpu: z.array(MetricDetailSchema),
    disk: z.array(MetricDetailSchema),
    network: z.array(MetricDetailSchema),
    ram: z.array(MetricDetailSchema),
  })
  .strip();

export const MetricsResultSchema = z
  .object({
    broken_down_by: MetricsTypeSchema, // The type of metric that is broken down, e.g. team, project
    metrics: MetricsMapEntrySchema,
    step: z.number(),
  })
  .strip();

export const GetMetricsResponseBodySchema = z
  .object({
    data: MetricsResultSchema,
  })
  .strip();

export const NodeMetricsMapEntrySchema = z
  .object({
    cpu: z.array(MetricDetailSchema),
    disk: z.array(MetricDetailSchema),
    filesystem: z.array(MetricDetailSchema),
    load: z.array(MetricDetailSchema),
    network: z.array(MetricDetailSchema),
    ram: z.array(MetricDetailSchema),
  })
  .strip();

export const NodeMetricsResultSchema = z
  .object({
    metrics: NodeMetricsMapEntrySchema,
    step: z.number(),
  })
  .strip();

export const GetNodeMetricsResponseBodySchema = z
  .object({
    data: NodeMetricsResultSchema,
  })
  .strip();

export const GetProjectResponseBodySchema = z
  .object({
    data: ProjectResponseSchema,
  })
  .strip();

export const GetServiceResponseBodySchema = z
  .object({
    data: ServiceResponseSchema,
  })
  .strip();

export const TeamResponseSchema = z
  .object({
    created_at: z.string().datetime(),
    description: z.string().nullable(),
    display_name: z.string(),
    id: z.string(),
    name: z.string(),
  })
  .strip();

export const GetTeamResponseBodySchema = z
  .object({
    data: TeamResponseSchema,
  })
  .strip();

export const GetWebhookResponseBodySchema = z
  .object({
    data: WebhookResponseSchema,
  })
  .strip();

export const PlanSchema = z
  .object({
    collaborators: z.number().optional(),
    filled_seats: z.number().optional(),
    name: z.string().optional(),
    private_repos: z.number().optional(),
    seats: z.number().optional(),
    space: z.number().optional(),
  })
  .strip();

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
  .strip();

export const GithubAdminOrganizationListResponseBodySchema = z
  .object({
    data: z.array(OrganizationSchema).nullable(),
  })
  .strip();

export const GithubRepositoryOwnerSchema = z
  .object({
    avatar_url: z.string(),
    id: z.number(),
    login: z.string(),
    name: z.string(),
  })
  .strip();

export const GithubRepositorySchema = z
  .object({
    clone_url: z.string(),
    full_name: z.string(),
    homepage: z.string(),
    html_url: z.string(),
    id: z.number(),
    installation_id: z.number(),
    name: z.string(),
    owner: GithubRepositoryOwnerSchema,
    updated_at: z.string().datetime(),
  })
  .strip();

export const GithubAdminRepositoryListResponseBodySchema = z
  .object({
    data: z.array(GithubRepositorySchema).nullable(),
  })
  .strip();

export const GithubInstallationPermissionsSchema = z
  .object({
    contents: z.string().optional(),
    metadata: z.string().optional(),
  })
  .strip();

export const GithubInstallationAPIResponseSchema = z
  .object({
    account_id: z.number().optional(),
    account_login: z.string().optional(),
    account_type: z.string().optional(),
    account_url: z.string().optional(),
    active: z.boolean().optional(),
    created_at: z.string().datetime().optional(),
    events: z.array(z.string()).nullable().optional(),
    github_app_id: z.number().optional(),
    id: z.number().optional(),
    permissions: GithubInstallationPermissionsSchema.optional(),
    repository_selection: z.string().optional(),
    suspended: z.boolean().optional(),
    updated_at: z.string().datetime().optional(),
  })
  .strip();

export const GithubAppAPIResponseSchema = z
  .object({
    created_at: z.string().datetime().optional(),
    created_by: z.string().optional(),
    id: z.number().optional(),
    installations: z.array(GithubInstallationAPIResponseSchema).nullable().optional(),
    name: z.string().optional(),
    updated_at: z.string().datetime().optional(),
  })
  .strip();

export const GithubAppCreateResponseBodySchema = z
  .object({
    data: z.string(),
  })
  .strip();

export const GithubAppInstallationListResponseBodySchema = z
  .object({
    data: z.array(GithubInstallationAPIResponseSchema).nullable(),
  })
  .strip();

export const GithubAppListResponseBodySchema = z
  .object({
    data: z.array(GithubAppAPIResponseSchema).nullable(),
  })
  .strip();

export const GithubBranchSchema = z
  .object({
    name: z.string(),
    protected: z.boolean(),
    ref: z.string(),
    sha: z.string(),
  })
  .strip();

export const GithubTagSchema = z
  .object({
    name: z.string(),
    ref: z.string(),
    sha: z.string(),
  })
  .strip();

export const GithubRepositoryDetailSchema = z
  .object({
    archived: z.boolean(),
    branches: z.array(GithubBranchSchema).nullable(),
    createdAt: z.string().datetime(),
    defaultBranch: z.string(),
    description: z.string(),
    disabled: z.boolean(),
    fork: z.boolean(),
    forksCount: z.number(),
    fullName: z.string(),
    htmlUrl: z.string(),
    id: z.number(),
    installationId: z.number(),
    language: z.string(),
    name: z.string(),
    openIssuesCount: z.number(),
    owner: GithubRepositoryOwnerSchema,
    private: z.boolean(),
    pushedAt: z.string().datetime(),
    size: z.number(),
    stargazersCount: z.number(),
    tags: z.array(GithubTagSchema).nullable(),
    updatedAt: z.string().datetime(),
    url: z.string(),
    watchersCount: z.number(),
  })
  .strip();

export const GithubRepositoryDetailResponseBodySchema = z
  .object({
    data: GithubRepositoryDetailSchema,
  })
  .strip();

export const InstanceTypeSchema = z.enum(['team', 'project', 'instance', 'service']);

export const InstanceStatusInputSchema = z
  .object({
    EnvironmentID: z.string().optional(),
    ProjectID: z.string().optional(),
    ServiceID: z.string().optional(),
    TeamID: z.string(),
    Type: InstanceTypeSchema,
  })
  .strip();

export const ItemSchema = z
  .object({
    name: z.string(),
    value: z.string(),
  })
  .strip();

export const ListDatabasesResponseBodySchema = z
  .object({
    data: z.array(DatabaseListSchema),
  })
  .strip();

export const PaginationResponseMetadataSchema = z
  .object({
    has_next: z.boolean(),
    next: z.string().datetime().optional(),
    previous: z.string().datetime().optional(),
  })
  .strip();

export const ListDeploymentResponseDataSchema = z
  .object({
    current_deployment: DeploymentResponseSchema.optional(),
    deployments: z.array(DeploymentResponseSchema).nullable(),
    metadata: PaginationResponseMetadataSchema,
  })
  .strip();

export const ListDeploymentsResponseBodySchema = z
  .object({
    data: ListDeploymentResponseDataSchema,
  })
  .strip();

export const ListEndpointsResponseBodySchema = z
  .object({
    data: EndpointDiscoverySchema,
  })
  .strip();

export const ListEnvironmentsOutputBodySchema = z
  .object({
    data: z.array(EnvironmentResponseSchema).nullable(),
  })
  .strip();

export const PodPhaseSchema = z.enum(['Pending', 'Running', 'Succeeded', 'Failed', 'Unknown']);

export const PodContainerStatusSchema = z
  .object({
    containers: z.array(ContainerStatusSchema),
    environment_id: z.string(),
    hasCrashingContainers: z.boolean(),
    initContainers: z.array(ContainerStatusSchema),
    name: z.string(),
    namespace: z.string(),
    phase: PodPhaseSchema,
    podIP: z.string().optional(),
    project_id: z.string(),
    service_id: z.string(),
    startTime: z.string().optional(),
    team_id: z.string(),
  })
  .strip();

export const ListInstancesResponseBodySchema = z
  .object({
    data: z.array(PodContainerStatusSchema),
  })
  .strip();

export const ListProjectResponseBodySchema = z
  .object({
    data: z.array(ProjectResponseSchema).nullable(),
  })
  .strip();

export const ListServiceResponseBodySchema = z
  .object({
    data: z.array(ServiceResponseSchema).nullable(),
  })
  .strip();

export const ListWebhooksResponseBodySchema = z
  .object({
    data: z.array(WebhookResponseSchema),
  })
  .strip();

export const LogMetadataSchema = z
  .object({
    deployment_id: z.string().optional(),
    environment_id: z.string().optional(),
    project_id: z.string().optional(),
    service_id: z.string().optional(),
    team_id: z.string().optional(),
  })
  .strip();

export const LogEventSchema = z
  .object({
    message: z.string(),
    metadata: LogMetadataSchema,
    pod_name: z.string(),
    timestamp: z.string().datetime().optional(),
  })
  .strip();

export const LogEventsMessageTypeSchema = z.enum(['log', 'heartbeat', 'error']);

export const LogEventsSchema = z
  .object({
    error_message: z.string().optional(),
    logs: z.array(LogEventSchema).nullable(),
    type: LogEventsMessageTypeSchema,
  })
  .strip();

export const LogTypeSchema = z.enum([
  'team',
  'project',
  'environment',
  'service',
  'deployment',
  'build',
]);

export const LokiDirectionSchema = z.enum(['forward', 'backward']);

export const UserAPIResponseSchema = z
  .object({
    created_at: z.string().datetime().optional(),
    email: z.string().optional(),
    id: z.string(),
    updated_at: z.string().datetime().optional(),
  })
  .strip();

export const MeResponseBodySchema = z
  .object({
    data: UserAPIResponseSchema,
  })
  .strip();

export const QueryLogsResponseBodySchema = z
  .object({
    data: z.array(LogEventSchema),
  })
  .strip();

export const ReferenceableVariablesResponseBodySchema = z
  .object({
    data: AvailableVariableReferenceResponseSchema,
  })
  .strip();

export const ResolveVariableReferenceResponseBodySchema = z
  .object({
    data: z.string(),
  })
  .strip();

export const RestartInstancesInputBodySchema = z
  .object({
    environment_id: z.string(),
    project_id: z.string(),
    service_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const RestartedSchema = z
  .object({
    restarted: z.boolean(),
  })
  .strip();

export const RestartServicesResponseBodySchema = z
  .object({
    data: RestartedSchema,
  })
  .strip();

export const SortByFieldSchema = z.enum(['created_at', 'updated_at']);

export const SortOrderSchema = z.enum(['asc', 'desc']);

export const SystemMetaSchema = z
  .object({
    buildkit_settings: BuildkitSettingsResponseSchema,
    external_ipv4: z.string(),
    external_ipv6: z.string(),
  })
  .strip();

export const SystemMetaResponseBodySchema = z
  .object({
    data: SystemMetaSchema,
  })
  .strip();

export const TeamResponseBodySchema = z
  .object({
    data: z.array(TeamResponseSchema),
  })
  .strip();

export const UpdatServiceResponseBodySchema = z
  .object({
    data: ServiceResponseSchema,
  })
  .strip();

export const UpdateEnvironmentInputSchema = z
  .object({
    description: z.string().nullable(),
    environment_id: z.string(),
    name: z.string().nullable(),
    project_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const UpdateEnvironmentResponseBodySchema = z
  .object({
    data: EnvironmentResponseSchema,
  })
  .strip();

export const UpdateProjectInputBodySchema = z
  .object({
    default_environment_id: z.string().optional(),
    description: z.string().nullable().optional(),
    display_name: z.string().optional(),
    project_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const UpdateProjectResponseBodySchema = z
  .object({
    data: ProjectResponseSchema,
  })
  .strip();

export const UpdateServiceInputSchema = z
  .object({
    auto_deploy: z.boolean().optional(),
    builder: ServiceBuilderSchema.optional(),
    database_config: z.record(z.any()).optional(),
    description: z.string().nullable().optional(),
    display_name: z.string().nullable().optional(),
    dockerfile_context: z.string().optional(), // Optional path to Dockerfile context, if using docker builder - set empty string to reset to default
    dockerfile_path: z.string().optional(), // Optional path to Dockerfile, if using docker builder - set empty string to reset to default
    environment_id: z.string(),
    git_branch: z.string().optional(),
    hosts: z.array(HostSpecSchema).nullable().optional(),
    image: z.string().optional(),
    ports: z.array(PortSpecSchema).nullable().optional(),
    project_id: z.string(),
    public: z.boolean().optional(),
    replicas: z.number().optional(),
    run_command: z.string().optional(),
    service_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const UpdateTeamInputBodySchema = z
  .object({
    description: z.string().nullable(),
    display_name: z.string(),
    team_id: z.string(),
  })
  .strip();

export const UpdateTeamResponseBodySchema = z
  .object({
    data: TeamResponseSchema,
  })
  .strip();

export const UpdateWebhookResponseBodySchema = z
  .object({
    data: WebhookResponseSchema,
  })
  .strip();

export const VariableUpdateBehaviorSchema = z.enum(['upsert', 'overwrite']);

export const UpsertVariablesInputBodySchema = z
  .object({
    behavior: VariableUpdateBehaviorSchema, // The behavior of the update - upsert or overwrite
    environment_id: z.string().optional(), // If present without service_id, mutate environment variables - requires project_id
    project_id: z.string().optional(), // If present without environment_id, mutate team variables
    service_id: z.string().optional(), // If present, mutate service variables - requires project_id and environment_id
    team_id: z.string(),
    type: VariableReferenceSourceTypeSchema, // The type of variable
    variables: z.array(ItemSchema).nullable(),
  })
  .strip();

export const VariableResponseItemSchema = z
  .object({
    name: z.string(),
    type: VariableReferenceSourceTypeSchema,
    value: z.string(),
  })
  .strip();

export const VariableResponseSchema = z
  .object({
    items: z.array(VariableResponseItemSchema),
    references: z.array(VariableReferenceResponseSchema),
  })
  .strip();

export const VariablesResponseBodySchema = z
  .object({
    data: VariableResponseSchema,
  })
  .strip();

export const WebhookCreateInputSchema = z
  .object({
    events: z.array(z.any()),
    project_id: z.string().optional(), // required if type is project
    team_id: z.string(),
    type: WebhookTypeSchema,
    url: z.string(),
  })
  .strip();

export const WebhookEventSchema = z.enum([
  'project.created',
  'project.updated',
  'project.deleted',
  'service.created',
  'service.updated',
  'service.deleted',
  'deployment.queued',
  'deployment.building',
  'deployment.succeeded',
  'deployment.failed',
  'deployment.cancelled',
]);

export const WebhookUpdateInputSchema = z
  .object({
    events: z.array(z.any()).nullable().optional(),
    id: z.string(),
    project_id: z.string().optional(), // required if type is project
    team_id: z.string(),
    url: z.string().nullable().optional(),
  })
  .strip();

export type VariableReferenceSourceType = z.infer<typeof VariableReferenceSourceTypeSchema>;
export type VariableReferenceType = z.infer<typeof VariableReferenceTypeSchema>;
export type AvailableVariableReference = z.infer<typeof AvailableVariableReferenceSchema>;
export type AvailableVariableReferenceResponse = z.infer<
  typeof AvailableVariableReferenceResponseSchema
>;
export type BuildkitSettingsResponse = z.infer<typeof BuildkitSettingsResponseSchema>;
export type BuildkitSettingsUpdateInputBody = z.infer<typeof BuildkitSettingsUpdateInputBodySchema>;
export type BuildkitSettingsUpdateResponseBody = z.infer<
  typeof BuildkitSettingsUpdateResponseBodySchema
>;
export type CallbackResponseBody = z.infer<typeof CallbackResponseBodySchema>;
export type ContainerState = z.infer<typeof ContainerStateSchema>;
export type ContainerStatus = z.infer<typeof ContainerStatusSchema>;
export type CreateBuildInputBody = z.infer<typeof CreateBuildInputBodySchema>;
export type GitCommitter = z.infer<typeof GitCommitterSchema>;
export type DeploymentStatus = z.infer<typeof DeploymentStatusSchema>;
export type DeploymentResponse = z.infer<typeof DeploymentResponseSchema>;
export type CreateBuildOutputBody = z.infer<typeof CreateBuildOutputBodySchema>;
export type CreateEnvironmentInput = z.infer<typeof CreateEnvironmentInputSchema>;
export type EnvironmentResponse = z.infer<typeof EnvironmentResponseSchema>;
export type CreateEnvironmentResponseBody = z.infer<typeof CreateEnvironmentResponseBodySchema>;
export type CreateProjectInputBody = z.infer<typeof CreateProjectInputBodySchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type CreateProjectResponseBody = z.infer<typeof CreateProjectResponseBodySchema>;
export type ServiceBuilder = z.infer<typeof ServiceBuilderSchema>;
export type HostSpec = z.infer<typeof HostSpecSchema>;
export type Protocol = z.infer<typeof ProtocolSchema>;
export type PortSpec = z.infer<typeof PortSpecSchema>;
export type ServiceType = z.infer<typeof ServiceTypeSchema>;
export type CreateServiceInput = z.infer<typeof CreateServiceInputSchema>;
export type ServiceConfigResponse = z.infer<typeof ServiceConfigResponseSchema>;
export type ServiceResponse = z.infer<typeof ServiceResponseSchema>;
export type CreateServiceResponseBody = z.infer<typeof CreateServiceResponseBodySchema>;
export type VariableReferenceSource = z.infer<typeof VariableReferenceSourceSchema>;
export type CreateVariableReferenceInput = z.infer<typeof CreateVariableReferenceInputSchema>;
export type VariableReferenceResponse = z.infer<typeof VariableReferenceResponseSchema>;
export type CreateVariableReferenceResponseBody = z.infer<
  typeof CreateVariableReferenceResponseBodySchema
>;
export type WebhookTeamEvent = z.infer<typeof WebhookTeamEventSchema>;
export type WebhookProjectEvent = z.infer<typeof WebhookProjectEventSchema>;
export type WebhookType = z.infer<typeof WebhookTypeSchema>;
export type WebhookResponse = z.infer<typeof WebhookResponseSchema>;
export type CreateWebhookResponseBody = z.infer<typeof CreateWebhookResponseBodySchema>;
export type DataStruct = z.infer<typeof DataStructSchema>;
export type DatabaseList = z.infer<typeof DatabaseListSchema>;
export type ParameterProperty = z.infer<typeof ParameterPropertySchema>;
export type DefinitionParameterSchema = z.infer<typeof DefinitionParameterSchemaSchema>;
export type Definition = z.infer<typeof DefinitionSchema>;
export type DeleteEnvironmentInputBody = z.infer<typeof DeleteEnvironmentInputBodySchema>;
export type DeleteEnvironmentResponseBody = z.infer<typeof DeleteEnvironmentResponseBodySchema>;
export type DeleteProjectInputBody = z.infer<typeof DeleteProjectInputBodySchema>;
export type DeleteProjectResponseBody = z.infer<typeof DeleteProjectResponseBodySchema>;
export type DeleteServiceInputBody = z.infer<typeof DeleteServiceInputBodySchema>;
export type DeleteServiceResponseBody = z.infer<typeof DeleteServiceResponseBodySchema>;
export type VariableDeleteInput = z.infer<typeof VariableDeleteInputSchema>;
export type DeleteVariablesInputBody = z.infer<typeof DeleteVariablesInputBodySchema>;
export type DeleteWebhookInputBody = z.infer<typeof DeleteWebhookInputBodySchema>;
export type DeleteWebhookResponseBody = z.infer<typeof DeleteWebhookResponseBodySchema>;
export type ExtendedHostSpec = z.infer<typeof ExtendedHostSpecSchema>;
export type IngressEndpoint = z.infer<typeof IngressEndpointSchema>;
export type ServiceEndpoint = z.infer<typeof ServiceEndpointSchema>;
export type EndpointDiscovery = z.infer<typeof EndpointDiscoverySchema>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type ErrorModel = z.infer<typeof ErrorModelSchema>;
export type GetDatabaseResponseBody = z.infer<typeof GetDatabaseResponseBodySchema>;
export type GetDeploymentResponseBody = z.infer<typeof GetDeploymentResponseBodySchema>;
export type GetEnvironmentOutputBody = z.infer<typeof GetEnvironmentOutputBodySchema>;
export type MetricsType = z.infer<typeof MetricsTypeSchema>;
export type MetricDetail = z.infer<typeof MetricDetailSchema>;
export type MetricsMapEntry = z.infer<typeof MetricsMapEntrySchema>;
export type MetricsResult = z.infer<typeof MetricsResultSchema>;
export type GetMetricsResponseBody = z.infer<typeof GetMetricsResponseBodySchema>;
export type NodeMetricsMapEntry = z.infer<typeof NodeMetricsMapEntrySchema>;
export type NodeMetricsResult = z.infer<typeof NodeMetricsResultSchema>;
export type GetNodeMetricsResponseBody = z.infer<typeof GetNodeMetricsResponseBodySchema>;
export type GetProjectResponseBody = z.infer<typeof GetProjectResponseBodySchema>;
export type GetServiceResponseBody = z.infer<typeof GetServiceResponseBodySchema>;
export type TeamResponse = z.infer<typeof TeamResponseSchema>;
export type GetTeamResponseBody = z.infer<typeof GetTeamResponseBodySchema>;
export type GetWebhookResponseBody = z.infer<typeof GetWebhookResponseBodySchema>;
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
export type GithubInstallationPermissions = z.infer<typeof GithubInstallationPermissionsSchema>;
export type GithubInstallationAPIResponse = z.infer<typeof GithubInstallationAPIResponseSchema>;
export type GithubAppAPIResponse = z.infer<typeof GithubAppAPIResponseSchema>;
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
export type InstanceType = z.infer<typeof InstanceTypeSchema>;
export type InstanceStatusInput = z.infer<typeof InstanceStatusInputSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type ListDatabasesResponseBody = z.infer<typeof ListDatabasesResponseBodySchema>;
export type PaginationResponseMetadata = z.infer<typeof PaginationResponseMetadataSchema>;
export type ListDeploymentResponseData = z.infer<typeof ListDeploymentResponseDataSchema>;
export type ListDeploymentsResponseBody = z.infer<typeof ListDeploymentsResponseBodySchema>;
export type ListEndpointsResponseBody = z.infer<typeof ListEndpointsResponseBodySchema>;
export type ListEnvironmentsOutputBody = z.infer<typeof ListEnvironmentsOutputBodySchema>;
export type PodPhase = z.infer<typeof PodPhaseSchema>;
export type PodContainerStatus = z.infer<typeof PodContainerStatusSchema>;
export type ListInstancesResponseBody = z.infer<typeof ListInstancesResponseBodySchema>;
export type ListProjectResponseBody = z.infer<typeof ListProjectResponseBodySchema>;
export type ListServiceResponseBody = z.infer<typeof ListServiceResponseBodySchema>;
export type ListWebhooksResponseBody = z.infer<typeof ListWebhooksResponseBodySchema>;
export type LogMetadata = z.infer<typeof LogMetadataSchema>;
export type LogEvent = z.infer<typeof LogEventSchema>;
export type LogEventsMessageType = z.infer<typeof LogEventsMessageTypeSchema>;
export type LogEvents = z.infer<typeof LogEventsSchema>;
export type LogType = z.infer<typeof LogTypeSchema>;
export type LokiDirection = z.infer<typeof LokiDirectionSchema>;
export type UserAPIResponse = z.infer<typeof UserAPIResponseSchema>;
export type MeResponseBody = z.infer<typeof MeResponseBodySchema>;
export type QueryLogsResponseBody = z.infer<typeof QueryLogsResponseBodySchema>;
export type ReferenceableVariablesResponseBody = z.infer<
  typeof ReferenceableVariablesResponseBodySchema
>;
export type ResolveVariableReferenceResponseBody = z.infer<
  typeof ResolveVariableReferenceResponseBodySchema
>;
export type RestartInstancesInputBody = z.infer<typeof RestartInstancesInputBodySchema>;
export type Restarted = z.infer<typeof RestartedSchema>;
export type RestartServicesResponseBody = z.infer<typeof RestartServicesResponseBodySchema>;
export type SortByField = z.infer<typeof SortByFieldSchema>;
export type SortOrder = z.infer<typeof SortOrderSchema>;
export type SystemMeta = z.infer<typeof SystemMetaSchema>;
export type SystemMetaResponseBody = z.infer<typeof SystemMetaResponseBodySchema>;
export type TeamResponseBody = z.infer<typeof TeamResponseBodySchema>;
export type UpdatServiceResponseBody = z.infer<typeof UpdatServiceResponseBodySchema>;
export type UpdateEnvironmentInput = z.infer<typeof UpdateEnvironmentInputSchema>;
export type UpdateEnvironmentResponseBody = z.infer<typeof UpdateEnvironmentResponseBodySchema>;
export type UpdateProjectInputBody = z.infer<typeof UpdateProjectInputBodySchema>;
export type UpdateProjectResponseBody = z.infer<typeof UpdateProjectResponseBodySchema>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceInputSchema>;
export type UpdateTeamInputBody = z.infer<typeof UpdateTeamInputBodySchema>;
export type UpdateTeamResponseBody = z.infer<typeof UpdateTeamResponseBodySchema>;
export type UpdateWebhookResponseBody = z.infer<typeof UpdateWebhookResponseBodySchema>;
export type VariableUpdateBehavior = z.infer<typeof VariableUpdateBehaviorSchema>;
export type UpsertVariablesInputBody = z.infer<typeof UpsertVariablesInputBodySchema>;
export type VariableResponseItem = z.infer<typeof VariableResponseItemSchema>;
export type VariableResponse = z.infer<typeof VariableResponseSchema>;
export type VariablesResponseBody = z.infer<typeof VariablesResponseBodySchema>;
export type WebhookCreateInput = z.infer<typeof WebhookCreateInputSchema>;
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
export type WebhookUpdateInput = z.infer<typeof WebhookUpdateInputSchema>;

export const callbackQuerySchema = z
  .object({
    code: z.string(),
  })
  .passthrough();

export const get_deploymentQuerySchema = z
  .object({
    team_id: z.string(), // The ID of the team
    project_id: z.string(), // The ID of the project
    environment_id: z.string(), // The ID of the environment
    service_id: z.string(), // The ID of the service
    deployment_id: z.string(), // The ID of the deployment
  })
  .passthrough();

export const list_deploymentsQuerySchema = z
  .object({
    cursor: z.string().datetime().optional(),
    per_page: z.number(),
    team_id: z.string(), // The ID of the team
    project_id: z.string(), // The ID of the project
    environment_id: z.string(), // The ID of the environment
    service_id: z.string(), // The ID of the service
    statuses: z.array(DeploymentStatusSchema).nullable().optional(), // Filter by status
  })
  .passthrough();

export const get_environmentQuerySchema = z
  .object({
    id: z.string(),
    team_id: z.string(),
    project_id: z.string(),
  })
  .passthrough();

export const list_environmentsQuerySchema = z
  .object({
    team_id: z.string(),
    project_id: z.string(),
  })
  .passthrough();

export const app_createQuerySchema = z
  .object({
    redirect_url: z.string(), // The client URL to redirect to after the installation is finished
    organization: z.string().optional(), // The organization to install the app for, if any
  })
  .passthrough();

export const list_appsQuerySchema = z
  .object({
    with_installations: z.boolean().optional(),
  })
  .passthrough();

export const repo_detailQuerySchema = z
  .object({
    installation_id: z.number(),
    owner: z.string(),
    repo_name: z.string(),
  })
  .passthrough();

export const query_logsQuerySchema = z
  .object({
    type: LogTypeSchema,
    team_id: z.string(),
    project_id: z.string().optional(),
    environment_id: z.string().optional(),
    service_id: z.string().optional(),
    deployment_id: z.string().optional(),
    filters: z.string().optional(), // Optional logql filter string
    start: z.string().datetime().optional(), // Start time for the query
    end: z.string().datetime().optional(), // End time for the query
    since: z.string().optional(), // Duration to look back (e.g., '1h', '30m')
    limit: z.number().optional(), // Number of log lines to get
    direction: LokiDirectionSchema.optional(), // Direction of the logs (forward or backward)
  })
  .passthrough();

export const stream_logsQuerySchema = z
  .object({
    type: LogTypeSchema,
    team_id: z.string(),
    project_id: z.string().optional(),
    environment_id: z.string().optional(),
    service_id: z.string().optional(),
    deployment_id: z.string().optional(),
    start: z.string().datetime().optional(),
    since: z.string().optional(), // Duration to look back (e.g., '1h', '30m')
    limit: z.number().optional(), // Number of lines to get from the end
    timestamps: z.boolean().optional(), // Include timestamps in logs
    filters: z.string().optional(), // Optional logql filter string
  })
  .passthrough();

export const get_metricsQuerySchema = z
  .object({
    type: MetricsTypeSchema,
    team_id: z.string(),
    project_id: z.string().optional(),
    environment_id: z.string().optional(),
    service_id: z.string().optional(),
    start: z.string().datetime().optional(), // Start time for the query, defaults to 1 week ago
    end: z.string().datetime().optional(), // End time for the query, defaults to now
  })
  .passthrough();

export const get_syste__metricsQuerySchema = z
  .object({
    node_name: z.string().optional(),
    zone: z.string().optional(),
    region: z.string().optional(),
    cluster_name: z.string().optional(),
    start: z.string().datetime().optional(), // Start time for the query, defaults to 24 hours ago
    end: z.string().datetime().optional(), // End time for the query, defaults to now
  })
  .passthrough();

export const get_projectQuerySchema = z
  .object({
    project_id: z.string(),
    team_id: z.string(),
  })
  .passthrough();

export const list_projectsQuerySchema = z
  .object({
    sort_by: SortByFieldSchema.optional(),
    sort_order: SortOrderSchema.optional(),
    team_id: z.string(),
  })
  .passthrough();

export const get_database_definitionQuerySchema = z
  .object({
    type: z.string(),
    version: z.string().optional(),
  })
  .passthrough();

export const list_service_endpointsQuerySchema = z
  .object({
    team_id: z.string(),
    project_id: z.string(),
    environment_id: z.string(),
    service_id: z.string(),
  })
  .passthrough();

export const get_serviceQuerySchema = z
  .object({
    service_id: z.string(),
    team_id: z.string(),
    project_id: z.string(),
    environment_id: z.string(),
  })
  .passthrough();

export const list_serviceQuerySchema = z
  .object({
    team_id: z.string(),
    project_id: z.string(),
    environment_id: z.string(),
  })
  .passthrough();

export const get_teamQuerySchema = z
  .object({
    team_id: z.string(),
  })
  .passthrough();

export const get_webhookQuerySchema = z
  .object({
    id: z.string(),
    team_id: z.string(),
    project_id: z.string().optional(),
  })
  .passthrough();

export const list_webhooksQuerySchema = z
  .object({
    type: WebhookTypeSchema,
    team_id: z.string(),
    project_id: z.string().optional(),
  })
  .passthrough();

export const list_variablesQuerySchema = z
  .object({
    type: VariableReferenceSourceTypeSchema, // The type of variable
    team_id: z.string(),
    project_id: z.string().optional(), // If present, fetch project variables
    environment_id: z.string().optional(), // If present, fetch environment variables - requires project_id
    service_id: z.string().optional(), // If present, fetch service variables - requires project_id and environment_id
  })
  .passthrough();

export const list_available_referencesQuerySchema = z
  .object({
    team_id: z.string(),
    project_id: z.string(),
    environment_id: z.string(),
    service_id: z.string(),
  })
  .passthrough();

export const read_variable_referenceQuerySchema = z
  .object({
    team_id: z.string().optional(),
    type: VariableReferenceTypeSchema.optional(),
    name: z.string().optional(),
    source_type: VariableReferenceSourceTypeSchema.optional(),
    source_id: z.string().optional(),
    key: z.string().optional(),
  })
  .passthrough();

export const app_saveQuerySchema = z
  .object({
    code: z.string(),
    state: z.string(),
  })
  .passthrough();

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
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
      get: async (
        params: z.infer<typeof get_deploymentQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetDeploymentResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/deployments/get`);
          const validatedQuery = get_deploymentQuerySchema.parse(params);
          const queryKeys = [
            'team_id',
            'project_id',
            'environment_id',
            'service_id',
            'deployment_id',
          ];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
          return GetDeploymentResponseBodySchema.parse(data);
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
            'per_page',
            'team_id',
            'project_id',
            'environment_id',
            'service_id',
            'statuses',
          ];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
      create: async (
        params: CreateEnvironmentInput,
        fetchOptions?: RequestInit,
      ): Promise<CreateEnvironmentResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/environments/create`);

          const options: RequestInit = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = CreateEnvironmentInputSchema.parse(params);
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
          return CreateEnvironmentResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      delete: async (
        params: DeleteEnvironmentInputBody,
        fetchOptions?: RequestInit,
      ): Promise<DeleteEnvironmentResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/environments/delete`);

          const options: RequestInit = {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = DeleteEnvironmentInputBodySchema.parse(params);
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
          return DeleteEnvironmentResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
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
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
      list: async (
        params: z.infer<typeof list_environmentsQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<ListEnvironmentsOutputBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/environments/list`);
          const validatedQuery = list_environmentsQuerySchema.parse(params);
          const queryKeys = ['team_id', 'project_id'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
          return ListEnvironmentsOutputBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      update: async (
        params: UpdateEnvironmentInput,
        fetchOptions?: RequestInit,
      ): Promise<UpdateEnvironmentResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/environments/update`);

          const options: RequestInit = {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = UpdateEnvironmentInputSchema.parse(params);
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
          return UpdateEnvironmentResponseBodySchema.parse(data);
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
              const value = validatedQuery[key as keyof typeof validatedQuery];
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
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
                const value = validatedQuery[key as keyof typeof validatedQuery];
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
    instances: {
      list: async (
        params: InstanceStatusInput,
        fetchOptions?: RequestInit,
      ): Promise<ListInstancesResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/instances/list`);

          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = InstanceStatusInputSchema.parse(params);
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
          return ListInstancesResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      restart: async (
        params: RestartInstancesInputBody,
        fetchOptions?: RequestInit,
      ): Promise<RestartServicesResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/instances/restart`);

          const options: RequestInit = {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = RestartInstancesInputBodySchema.parse(params);
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
          return RestartServicesResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    logs: {
      query: async (
        params: z.infer<typeof query_logsQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<QueryLogsResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/logs/query`);
          const validatedQuery = query_logsQuerySchema.parse(params);
          const queryKeys = [
            'type',
            'team_id',
            'project_id',
            'environment_id',
            'service_id',
            'deployment_id',
            'filters',
            'start',
            'end',
            'since',
            'limit',
            'direction',
          ];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
          return QueryLogsResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
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
            'deployment_id',
            'start',
            'since',
            'limit',
            'timestamps',
            'filters',
          ];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
    metrics: {
      get: async (
        params: z.infer<typeof get_metricsQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetMetricsResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/metrics/get`);
          const validatedQuery = get_metricsQuerySchema.parse(params);
          const queryKeys = [
            'type',
            'team_id',
            'project_id',
            'environment_id',
            'service_id',
            'start',
            'end',
          ];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
          return GetMetricsResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      getSystem: async (
        params: z.infer<typeof get_syste__metricsQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetNodeMetricsResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/metrics/get-system`);
          const validatedQuery = get_syste__metricsQuerySchema.parse(params);
          const queryKeys = ['node_name', 'zone', 'region', 'cluster_name', 'start', 'end'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
          return GetNodeMetricsResponseBodySchema.parse(data);
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
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
      databases: {
        installable: {
          get: async (
            params: z.infer<typeof get_database_definitionQuerySchema>,
            fetchOptions?: RequestInit,
          ): Promise<GetDatabaseResponseBody> => {
            try {
              if (!apiUrl || typeof apiUrl !== 'string') {
                throw new Error('API URL is undefined or not a string');
              }
              const url = new URL(`${apiUrl}/services/databases/installable/get`);
              const validatedQuery = get_database_definitionQuerySchema.parse(params);
              const queryKeys = ['type', 'version'];
              queryKeys.forEach((key) => {
                const value = validatedQuery[key as keyof typeof validatedQuery];
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
              return GetDatabaseResponseBodySchema.parse(data);
            } catch (error) {
              console.error('Error in API request:', error);
              throw error;
            }
          },
          list: async (
            params?: undefined,
            fetchOptions?: RequestInit,
          ): Promise<ListDatabasesResponseBody> => {
            try {
              if (!apiUrl || typeof apiUrl !== 'string') {
                throw new Error('API URL is undefined or not a string');
              }
              const url = new URL(`${apiUrl}/services/databases/installable/list`);

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
              return ListDatabasesResponseBodySchema.parse(data);
            } catch (error) {
              console.error('Error in API request:', error);
              throw error;
            }
          },
        },
      },
      delete: async (
        params: DeleteServiceInputBody,
        fetchOptions?: RequestInit,
      ): Promise<DeleteServiceResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/services/delete`);

          const options: RequestInit = {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = DeleteServiceInputBodySchema.parse(params);
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
          return DeleteServiceResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      endpoints: {
        list: async (
          params: z.infer<typeof list_service_endpointsQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<ListEndpointsResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/services/endpoints/list`);
            const validatedQuery = list_service_endpointsQuerySchema.parse(params);
            const queryKeys = ['team_id', 'project_id', 'environment_id', 'service_id'];
            queryKeys.forEach((key) => {
              const value = validatedQuery[key as keyof typeof validatedQuery];
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
            return ListEndpointsResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
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
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
    system: {
      buildkit: {
        update: async (
          params: BuildkitSettingsUpdateInputBody,
          fetchOptions?: RequestInit,
        ): Promise<BuildkitSettingsUpdateResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/system/buildkit/update`);

            const options: RequestInit = {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };
            const validatedBody = BuildkitSettingsUpdateInputBodySchema.parse(params);
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
            return BuildkitSettingsUpdateResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
      },
      get: async (
        params?: undefined,
        fetchOptions?: RequestInit,
      ): Promise<SystemMetaResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/system/get`);

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
          return SystemMetaResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    teams: {
      get: async (
        params: z.infer<typeof get_teamQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetTeamResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/teams/get`);
          const validatedQuery = get_teamQuerySchema.parse(params);
          const queryKeys = ['team_id'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
          return GetTeamResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
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
    unbindwebhooks: {
      create: async (
        params: WebhookCreateInput,
        fetchOptions?: RequestInit,
      ): Promise<CreateWebhookResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/unbindwebhooks/create`);

          const options: RequestInit = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = WebhookCreateInputSchema.parse(params);
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
          return CreateWebhookResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      delete: async (
        params: DeleteWebhookInputBody,
        fetchOptions?: RequestInit,
      ): Promise<DeleteWebhookResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/unbindwebhooks/delete`);

          const options: RequestInit = {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = DeleteWebhookInputBodySchema.parse(params);
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
          return DeleteWebhookResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      get: async (
        params: z.infer<typeof get_webhookQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetWebhookResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/unbindwebhooks/get`);
          const validatedQuery = get_webhookQuerySchema.parse(params);
          const queryKeys = ['id', 'team_id', 'project_id'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
          return GetWebhookResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      list: async (
        params: z.infer<typeof list_webhooksQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<ListWebhooksResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/unbindwebhooks/list`);
          const validatedQuery = list_webhooksQuerySchema.parse(params);
          const queryKeys = ['type', 'team_id', 'project_id'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
          return ListWebhooksResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      update: async (
        params: WebhookUpdateInput,
        fetchOptions?: RequestInit,
      ): Promise<UpdateWebhookResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/unbindwebhooks/update`);

          const options: RequestInit = {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = WebhookUpdateInputSchema.parse(params);
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
          return UpdateWebhookResponseBodySchema.parse(data);
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
    variables: {
      delete: async (
        params: DeleteVariablesInputBody,
        fetchOptions?: RequestInit,
      ): Promise<VariablesResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/variables/delete`);

          const options: RequestInit = {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = DeleteVariablesInputBodySchema.parse(params);
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
          return VariablesResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      list: async (
        params: z.infer<typeof list_variablesQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<VariablesResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/variables/list`);
          const validatedQuery = list_variablesQuerySchema.parse(params);
          const queryKeys = ['type', 'team_id', 'project_id', 'environment_id', 'service_id'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
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
          return VariablesResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      references: {
        available: async (
          params: z.infer<typeof list_available_referencesQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<ReferenceableVariablesResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/variables/references/available`);
            const validatedQuery = list_available_referencesQuerySchema.parse(params);
            const queryKeys = ['team_id', 'project_id', 'environment_id', 'service_id'];
            queryKeys.forEach((key) => {
              const value = validatedQuery[key as keyof typeof validatedQuery];
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
            return ReferenceableVariablesResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        create: async (
          params: CreateVariableReferenceInput,
          fetchOptions?: RequestInit,
        ): Promise<CreateVariableReferenceResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/variables/references/create`);

            const options: RequestInit = {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };
            const validatedBody = CreateVariableReferenceInputSchema.parse(params);
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
            return CreateVariableReferenceResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        get: async (
          params: z.infer<typeof read_variable_referenceQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<ResolveVariableReferenceResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/variables/references/get`);
            const validatedQuery = read_variable_referenceQuerySchema.parse(params);
            const queryKeys = ['team_id', 'type', 'name', 'source_type', 'source_id', 'key'];
            queryKeys.forEach((key) => {
              const value = validatedQuery[key as keyof typeof validatedQuery];
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
            return ResolveVariableReferenceResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
      },
      update: async (
        params: UpsertVariablesInputBody,
        fetchOptions?: RequestInit,
      ): Promise<VariablesResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/variables/update`);

          const options: RequestInit = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = UpsertVariablesInputBodySchema.parse(params);
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
          return VariablesResponseBodySchema.parse(data);
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
                  const value = validatedQuery[key as keyof typeof validatedQuery];
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
