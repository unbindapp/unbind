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
    source_icon: z.string(),
    source_id: z.string(),
    source_kubernetes_name: z.string(),
    source_name: z.string(),
    source_type: VariableReferenceSourceTypeSchema,
    type: VariableReferenceTypeSchema,
  })
  .strip();

export const BuildkitSettingsSchema = z
  .object({
    max_parallelism: z.number(),
    replicas: z.number(),
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

export const CapabilitiesSchema = z
  .object({
    add: z.array(z.string()).nullable().optional(),
    drop: z.array(z.string()).nullable().optional(),
  })
  .strip();

export const ContainerStateSchema = z.enum(['Running', 'Waiting', 'Terminated']);

export const CreateBuildInputBodySchema = z
  .object({
    environment_id: z.string(),
    git_sha: z.string().nullable().optional(), // The git sha of the deployment
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
    name: z.string(),
    project_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const EnvironmentResponseSchema = z
  .object({
    active: z.boolean(),
    created_at: z.string().datetime(),
    description: z.string(),
    id: z.string(),
    kubernetes_name: z.string(),
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

export const PvcScopeSchema = z.enum(['team', 'project', 'environment']);

export const CreatePVCInputSchema = z
  .object({
    environment_id: z.string().optional(),
    name: z.string(), // Name of the PVC
    project_id: z.string().optional(),
    size: z.string(), // Size of the PVC (e.g., '10Gi')
    team_id: z.string(),
    type: PvcScopeSchema,
  })
  .strip();

export const PersistentVolumeClaimPhaseSchema = z.enum(['Pending', 'Bound', 'Lost']);

export const PVCInfoSchema = z
  .object({
    can_delete: z.boolean(),
    created_at: z.string().datetime(),
    environment_id: z.string().optional(),
    id: z.string(),
    is_available: z.boolean(),
    is_database: z.boolean(),
    mounted_on_service_id: z.string().optional(),
    name: z.string(),
    project_id: z.string().optional(),
    size: z.string(),
    status: PersistentVolumeClaimPhaseSchema,
    team_id: z.string(),
  })
  .strip();

export const CreatePVCResponseBodySchema = z
  .object({
    data: PVCInfoSchema,
  })
  .strip();

export const CreateProjectInputSchema = z
  .object({
    description: z.string().nullable().optional(),
    name: z.string(),
    team_id: z.string(),
  })
  .strip();

export const ProjectResponseSchema = z
  .object({
    created_at: z.string().datetime(),
    default_environment_id: z.string().optional(),
    description: z.string().nullable(),
    environment_count: z.number(),
    environments: z.array(EnvironmentResponseSchema),
    id: z.string(),
    kubernetes_name: z.string(),
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

export const S3BucketSchema = z
  .object({
    bucket_region: z.string(),
    created_at: z.string().datetime(),
    name: z.string(),
  })
  .strip();

export const S3ResponseSchema = z
  .object({
    access_key: z.string(),
    buckets: z.array(S3BucketSchema),
    created_at: z.string().datetime(),
    endpoint: z.string(),
    id: z.string(),
    name: z.string(),
    region: z.string(),
    secret_key: z.string(),
    updated_at: z.string().datetime(),
  })
  .strip();

export const CreateS3OutputBodySchema = z
  .object({
    data: S3ResponseSchema,
  })
  .strip();

export const ServiceBuilderSchema = z.enum(['railpack', 'docker', 'database']);

export const DatabaseConfigSchema = z
  .object({
    defaultDatabaseName: z.string().optional(),
    initdb: z.string().optional(),
    storage: z.string().optional(),
    version: z.string().optional(),
  })
  .strip();

export const HealthCheckTypeSchema = z.enum(['http', 'exec', 'none']);

export const HealthCheckSchema = z
  .object({
    command: z.string().optional(), // Command for exec health checks
    liveness_failure_threshold: z.number(), // Number of failures before the container is considered unhealthy
    path: z.string().optional(), // Path for http health checks
    period_seconds: z.number(), // Period in seconds for health checks
    port: z.number().optional(), // Port for http health checks
    readiness_failure_threshold: z.number(), // Number of failures before the container is considered unhealthy
    startup_failure_threshold: z.number(), // Number of failures before the container is considered unhealthy
    timeout_seconds: z.number(), // Timeout in seconds for health checks
    type: HealthCheckTypeSchema,
  })
  .strip();

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
    input_template_id: z.number().optional(), // For template port inputs
    is_nodeport: z.boolean().optional(),
    node_port: z.number().optional(),
    port: z.number(),
    protocol: ProtocolSchema.optional(),
  })
  .strip();

export const ServiceTypeSchema = z.enum(['github', 'docker-image', 'database']);

export const CreateServiceInputSchema = z
  .object({
    auto_deploy: z.boolean().optional(),
    backup_retention: z.number().optional(), // Number of base backups to retain, e.g. 3
    backup_schedule: z.string().optional(), // Cron expression for the backup schedule, e.g. '0 0 * * *'
    build_command: z.string().optional(),
    builder: ServiceBuilderSchema, // Builder of the service - docker, nixpacks, railpack
    database_config: DatabaseConfigSchema.optional(),
    database_type: z.string().optional(),
    description: z.string().optional(),
    dockerfile_context: z.string().optional(), // Optional path to Dockerfile context, if using docker builder
    dockerfile_path: z.string().optional(), // Optional path to Dockerfile, if using docker builder
    environment_id: z.string(),
    github_installation_id: z.number().optional(),
    health_check: HealthCheckSchema.optional(), // Health check configuration for the service
    hosts: z.array(HostSpecSchema).nullable().optional(),
    image: z.string().optional(),
    install_command: z.string().optional(),
    is_public: z.boolean().optional(),
    name: z.string(),
    ports: z.array(PortSpecSchema).nullable().optional(),
    project_id: z.string(),
    pvc_id: z.string().optional(), // ID of the PVC to use for the service
    pvc_mount_path: z.string().optional(), // Mount path for the PVC
    replicas: z.number().optional(),
    repository_name: z.string().optional(),
    repository_owner: z.string().optional(),
    run_command: z.string().optional(),
    s3_backup_bucket: z.string().optional(),
    s3_backup_source_id: z.string().optional(),
    team_id: z.string(),
    type: ServiceTypeSchema, // Type of service, e.g. 'github', 'docker-image'
  })
  .strip();

export const SecurityContextSchema = z
  .object({
    capabilities: CapabilitiesSchema.optional(),
    privileged: z.boolean().optional(),
  })
  .strip();

export const VariableMountSchema = z
  .object({
    name: z.string(), // Name of the variable to mount
    path: z.string(), // Path to mount the variable (e.g. /etc/secret)
  })
  .strip();

export const ServiceConfigResponseSchema = z
  .object({
    auto_deploy: z.boolean(),
    backup_retention_count: z.number(),
    backup_schedule: z.string(),
    build_command: z.string().optional(),
    builder: ServiceBuilderSchema,
    git_branch: z.string().optional(),
    git_tag: z.string().optional(),
    health_check: HealthCheckSchema.optional(),
    hosts: z.array(HostSpecSchema).optional(),
    icon: z.string(),
    image: z.string().optional(),
    install_command: z.string().optional(),
    is_public: z.boolean(),
    ports: z.array(PortSpecSchema).optional(),
    pvc_id: z.string().optional(),
    pvc_volume_mount_path: z.string().optional(),
    replicas: z.number(),
    run_command: z.string().optional(),
    s3_backup_bucket: z.string().optional(),
    s3_backup_source_id: z.string().optional(),
    security_context: SecurityContextSchema.optional(),
    variable_mounts: z.array(VariableMountSchema),
  })
  .strip();

export const TemplateInputTypeSchema = z.enum([
  'variable',
  'host',
  'volume_size',
  'node_port',
  'password',
]);

export const TemplateInputSchema = z
  .object({
    default: z.string().optional(),
    description: z.string(),
    id: z.number(),
    name: z.string(),
    required: z.boolean(),
    target_port: z.number().optional(),
    type: TemplateInputTypeSchema,
  })
  .strip();

export const TemplateVariableReferenceSchema = z
  .object({
    additional_template_sources: z.array(z.string()).nullable(),
    is_host: z.boolean(),
    resolve_as_normal_variable: z.boolean(),
    source_id: z.number(),
    source_name: z.string(),
    target_name: z.string(),
    template_string: z.string(),
  })
  .strip();

export const ValueHashTypeSchema = z.enum(['sha256', 'sha512']);

export const JWTParamsSchema = z
  .object({
    AnonOutputKey: z.string(),
    Issuer: z.string(),
    SecretOutputKey: z.string(),
    ServiceOutputKey: z.string(),
  })
  .strip();

export const GeneratorTypeSchema = z.enum(['password', 'bcrypt', 'input', 'jwt', 'string_replace']);

export const ValueGeneratorSchema = z
  .object({
    add_prefix: z.string().optional(),
    base_domain: z.string().optional(),
    hash_type: ValueHashTypeSchema.optional(),
    input_id: z.number().optional(),
    jwt_params: JWTParamsSchema.optional(),
    type: GeneratorTypeSchema,
  })
  .strip();

export const TemplateVariableSchema = z
  .object({
    generator: ValueGeneratorSchema.optional(),
    name: z.string(),
    value: z.string(),
  })
  .strip();

export const TemplateVolumeSizeSchema = z
  .object({
    from_input_id: z.number(),
  })
  .strip();

export const TemplateVolumeSchema = z
  .object({
    mountPath: z.string(),
    name: z.string(),
    size: TemplateVolumeSizeSchema,
  })
  .strip();

export const TemplateServiceSchema = z
  .object({
    builder: ServiceBuilderSchema,
    database_config: DatabaseConfigSchema.optional(),
    database_type: z.string().optional(),
    depends_on: z.array(z.number()),
    health_check: HealthCheckSchema.optional(),
    host_input_ids: z.array(z.number()).nullable().optional(),
    icon: z.string().optional(),
    id: z.number(),
    image: z.string().optional(),
    init_db_replacers: z.record(z.string()).optional(),
    is_public: z.boolean(),
    name: z.string(),
    ports: z.array(PortSpecSchema),
    run_command: z.string().optional(),
    security_context: SecurityContextSchema.optional(),
    type: ServiceTypeSchema,
    variable_references: z.array(TemplateVariableReferenceSchema),
    variables: z.array(TemplateVariableSchema),
    variables_mounts: z.array(VariableMountSchema),
    volumes: z.array(TemplateVolumeSchema),
  })
  .strip();

export const TemplateDefinitionSchema = z
  .object({
    description: z.string(),
    inputs: z.array(TemplateInputSchema),
    name: z.string(),
    services: z.array(TemplateServiceSchema),
    version: z.number(),
  })
  .strip();

export const TemplateWithDefinitionResponseSchema = z
  .object({
    created_at: z.string().datetime(),
    definition: TemplateDefinitionSchema,
    id: z.string(),
    immutable: z.boolean(),
    name: z.string(),
    version: z.number(),
  })
  .strip();

export const ServiceResponseSchema = z
  .object({
    config: ServiceConfigResponseSchema,
    created_at: z.string().datetime(),
    current_deployment: DeploymentResponseSchema.optional(),
    database_type: z.string().optional(),
    database_version: z.string().optional(),
    description: z.string(),
    environment_id: z.string(),
    git_repository: z.string().optional(),
    git_repository_owner: z.string().optional(),
    github_installation_id: z.number().optional(),
    id: z.string(),
    kubernetes_name: z.string(),
    last_deployment: DeploymentResponseSchema.optional(),
    last_successful_deployment: DeploymentResponseSchema.optional(),
    name: z.string(),
    template: TemplateWithDefinitionResponseSchema.optional(),
    template_instance_id: z.string().optional(),
    type: ServiceTypeSchema,
    updated_at: z.string().datetime(),
  })
  .strip();

export const CreateServiceResponseBodySchema = z
  .object({
    data: ServiceResponseSchema,
  })
  .strip();

export const CreateUserInputBodySchema = z
  .object({
    email: z.string(),
    password: z.string(),
  })
  .strip();

export const UserDataSchema = z
  .object({
    email: z.string(),
  })
  .strip();

export const CreateUserResponseBodySchema = z
  .object({
    data: UserDataSchema,
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

export const DatabaseConfigurableSchema = z
  .object({
    default: z.string(),
    options: z.array(z.string()),
  })
  .strip();

export const DatabaseConfigurablesSchema = z
  .object({
    version: DatabaseConfigurableSchema,
  })
  .strip();

export const DeleteEnvironmentInputBodySchema = z
  .object({
    environment_id: z.string(),
    project_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const DeletedResponseSchema = z
  .object({
    deleted: z.boolean(),
    id: z.string(),
  })
  .strip();

export const DeleteEnvironmentResponseBodySchema = z
  .object({
    data: DeletedResponseSchema,
  })
  .strip();

export const DeletePVCInputSchema = z
  .object({
    environment_id: z.string().optional(),
    id: z.string(),
    project_id: z.string().optional(),
    team_id: z.string(),
    type: PvcScopeSchema,
  })
  .strip();

export const DeletePVCResponseBodySchema = z
  .object({
    data: DeletedResponseSchema,
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
    data: DeletedResponseSchema,
  })
  .strip();

export const DeleteS3SourceByIDInputBodySchema = z
  .object({
    id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const DeleteS3SourceByIDOutputBodySchema = z
  .object({
    data: DeletedResponseSchema,
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
    data: DeletedResponseSchema,
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
    variable_reference_ids: z.array(z.string()).optional(),
    variables: z.array(VariableDeleteInputSchema).optional(),
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
    data: DeletedResponseSchema,
  })
  .strip();

export const DnsCheckSchema = z
  .object({
    cloudflare: z.boolean(),
    dns_configured: z.boolean(),
  })
  .strip();

export const DnsCheckResponseBodySchema = z
  .object({
    data: DnsCheckSchema,
  })
  .strip();

export const ExtendedHostSpecSchema = z
  .object({
    cloudflare: z.boolean(),
    dns_configured: z.boolean(),
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
    is_ingress: z.boolean(),
    kubernetes_name: z.string(),
    project_id: z.string(),
    service_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const ServiceEndpointSchema = z
  .object({
    dns: z.string(),
    environment_id: z.string(),
    kubernetes_name: z.string(),
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
    data: DatabaseConfigurablesSchema,
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

export const InstanceHealthSchema = z.enum(['healthy', 'degraded', 'unhealthy']);

export const SimpleInstanceStatusSchema = z
  .object({
    kubernetes_name: z.string(),
    status: ContainerStateSchema,
  })
  .strip();

export const SimpleHealthStatusSchema = z
  .object({
    expectedInstances: z.number(),
    health: InstanceHealthSchema,
    instances: z.array(SimpleInstanceStatusSchema).nullable(),
  })
  .strip();

export const GetInstanceHealthResponseBodySchema = z
  .object({
    data: SimpleHealthStatusSchema,
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

export const GetPVCResponseBodySchema = z
  .object({
    data: PVCInfoSchema,
  })
  .strip();

export const GetProjectResponseBodySchema = z
  .object({
    data: ProjectResponseSchema,
  })
  .strip();

export const GetS3SourceByIDOutputBodySchema = z
  .object({
    data: S3ResponseSchema,
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
    id: z.string(),
    kubernetes_name: z.string(),
    name: z.string(),
  })
  .strip();

export const GetTeamResponseBodySchema = z
  .object({
    data: TeamResponseSchema,
  })
  .strip();

export const GetTemplateResponseBodySchema = z
  .object({
    data: TemplateWithDefinitionResponseSchema,
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
    data: z.array(GithubRepositorySchema),
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
    created_at: z.string().datetime(),
    created_by: z.string(),
    id: z.number(),
    installations: z.array(GithubInstallationAPIResponseSchema),
    name: z.string(),
    updated_at: z.string().datetime(),
    uuid: z.string(),
  })
  .strip();

export const GithubAppCreateResponseBodySchema = z
  .object({
    data: z.string(),
  })
  .strip();

export const GithubAppGetResponseBodySchema = z
  .object({
    data: GithubAppAPIResponseSchema,
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

export const InstanceStatusSchema = z
  .object({
    crashLoopReason: z.string().optional(),
    isCrashing: z.boolean(),
    kubernetes_name: z.string(),
    lastExitCode: z.number().optional(),
    lastTermination: z.string().optional(),
    ready: z.boolean(),
    restartCount: z.number(),
    state: ContainerStateSchema,
    stateMessage: z.string().optional(),
    stateReason: z.string().optional(),
  })
  .strip();

export const InstanceTypeSchema = z.enum(['team', 'project', 'environment', 'service']);

export const ItemSchema = z
  .object({
    name: z.string(),
    value: z.string(),
  })
  .strip();

export const ListDatabasesResponseBodySchema = z
  .object({
    data: z.array(z.string()),
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
    data: z.array(EnvironmentResponseSchema),
  })
  .strip();

export const PodPhaseSchema = z.enum(['Pending', 'Running', 'Succeeded', 'Failed', 'Unknown']);

export const PodContainerStatusSchema = z
  .object({
    environment_id: z.string(),
    hasCrashingInstances: z.boolean(),
    instanceDependencies: z.array(InstanceStatusSchema),
    instances: z.array(InstanceStatusSchema),
    kubernetes_name: z.string(),
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

export const ListPVCResponseBodySchema = z
  .object({
    data: z.array(PVCInfoSchema),
  })
  .strip();

export const ListProjectResponseBodySchema = z
  .object({
    data: z.array(ProjectResponseSchema),
  })
  .strip();

export const ListS3SourceOutputBodySchema = z
  .object({
    data: z.array(S3ResponseSchema),
  })
  .strip();

export const ListServiceResponseBodySchema = z
  .object({
    data: z.array(ServiceResponseSchema),
  })
  .strip();

export const TemplateShortResponseSchema = z
  .object({
    created_at: z.string().datetime(),
    id: z.string(),
    immutable: z.boolean(),
    name: z.string(),
    version: z.number(),
  })
  .strip();

export const ListTemplatesResponseBodySchema = z
  .object({
    data: z.array(TemplateShortResponseSchema).nullable(),
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

export const LoginFormSchema = z
  .object({
    client_id: z.string(),
    initiating_url: z.string(),
    page_key: z.string(),
    password: z.string(),
    redirect_uri: z.string(),
    response_type: z.string(),
    scope: z.string(),
    state: z.string(),
    username: z.string(),
  })
  .strip();

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

export const RedeployInputBodySchema = z
  .object({
    deployment_id: z.string(),
    environment_id: z.string(),
    project_id: z.string(),
    service_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const RedeployOutputBodySchema = z
  .object({
    data: DeploymentResponseSchema,
  })
  .strip();

export const ReferenceableVariablesResponseBodySchema = z
  .object({
    data: z.array(AvailableVariableReferenceSchema),
  })
  .strip();

export const ResolveAvailableVariableReferenceResponseBodySchema = z
  .object({
    data: z.string(),
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

export const S3BackendCreateInputSchema = z
  .object({
    access_key_id: z.string(),
    endpoint: z.string(),
    name: z.string(),
    region: z.string(),
    secret_key: z.string(),
    team_id: z.string(),
  })
  .strip();

export const S3TestResultSchema = z
  .object({
    error: z.string().optional(),
    valid: z.boolean(),
  })
  .strip();

export const SystemSettingsResponseSchema = z
  .object({
    buildkit_settings: BuildkitSettingsSchema.optional(),
    can_update_buildkit: z.boolean(), // If not externally managed, this indicates if the user can update buildkit settings
    wildcard_domain: z.string().optional(),
  })
  .strip();

export const SettingsResponseBodySchema = z
  .object({
    data: SystemSettingsResponseSchema,
  })
  .strip();

export const SetupDataSchema = z
  .object({
    is_bootstrapped: z.boolean(),
    is_first_user_created: z.boolean(),
  })
  .strip();

export const SetupStatusResponseBodySchema = z
  .object({
    data: SetupDataSchema,
  })
  .strip();

export const SortByFieldSchema = z.enum(['created_at', 'updated_at']);

export const SortOrderSchema = z.enum(['asc', 'desc']);

export const SystemMetaSchema = z
  .object({
    external_ipv4: z.string(),
    external_ipv6: z.string(),
    system_settings: SystemSettingsResponseSchema,
  })
  .strip();

export const SystemMetaResponseBodySchema = z
  .object({
    data: SystemMetaSchema,
  })
  .strip();

export const SystemSettingUpdateInputSchema = z
  .object({
    buildkit_settings: BuildkitSettingsSchema, // Buildkit settings
    wildcard_domain: z.string().nullable(), // Wildcard domain for the system
  })
  .strip();

export const TeamResponseBodySchema = z
  .object({
    data: z.array(TeamResponseSchema),
  })
  .strip();

export const TemplateInputValueSchema = z
  .object({
    id: z.number(),
    value: z.string(),
  })
  .strip();

export const TemplateDeployInputSchema = z
  .object({
    environment_id: z.string(),
    inputs: z.array(TemplateInputValueSchema).nullable().optional(),
    project_id: z.string(),
    team_id: z.string(),
    template_id: z.string(),
  })
  .strip();

export const TemplateDeployResponseBodySchema = z
  .object({
    data: z.array(ServiceResponseSchema).nullable(),
  })
  .strip();

export const TestS3AccessInputBodySchema = z
  .object({
    access_key_id: z.string(),
    endpoint: z.string(),
    region: z.string(),
    secret_key: z.string(),
  })
  .strip();

export const TestS3OutputBodySchema = z
  .object({
    data: S3TestResultSchema,
  })
  .strip();

export const UpdatServiceResponseBodySchema = z
  .object({
    data: ServiceResponseSchema,
  })
  .strip();

export const UpdateApplyInputBodySchema = z
  .object({
    target_version: z.string(),
  })
  .strip();

export const UpdateApplyResponseBodySchema = z
  .object({
    started: z.boolean(),
  })
  .strip();

export const UpdateCheckResponseBodySchema = z
  .object({
    available_versions: z.array(z.string()),
    current_version: z.string(),
    has_update_available: z.boolean(),
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

export const UpdatePVCInputSchema = z
  .object({
    environment_id: z.string().optional(),
    id: z.string(),
    name: z.string().nullable().optional(), // Name of the PVC
    project_id: z.string().optional(),
    size: z.string().nullable().optional(), // Size of the PVC (e.g., '10Gi')
    team_id: z.string(),
    type: PvcScopeSchema,
  })
  .strip();

export const UpdatePVCResponseBodySchema = z
  .object({
    data: PVCInfoSchema,
  })
  .strip();

export const UpdateProjectInputSchema = z
  .object({
    default_environment_id: z.string().optional(),
    description: z.string().nullable().optional(),
    name: z.string().optional(),
    project_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const UpdateProjectResponseBodySchema = z
  .object({
    data: ProjectResponseSchema,
  })
  .strip();

export const UpdateS3SourceInputBodySchema = z
  .object({
    access_key_id: z.string().optional(),
    id: z.string(),
    name: z.string().optional(),
    secret_key: z.string().optional(),
    team_id: z.string(),
  })
  .strip();

export const UpdateS3SourceResponseBodySchema = z
  .object({
    data: S3ResponseSchema,
  })
  .strip();

export const UpdateServiceInputSchema = z
  .object({
    auto_deploy: z.boolean().optional(),
    backup_retention: z.number().optional(), // Number of base backups to retain, e.g. 3
    backup_schedule: z.string().optional(), // Cron expression for the backup schedule, e.g. '0 0 * * *'
    build_command: z.string().optional(),
    builder: ServiceBuilderSchema.optional(),
    database_config: DatabaseConfigSchema.optional(),
    description: z.string().nullable().optional(),
    dockerfile_context: z.string().optional(), // Optional path to Dockerfile context, if using docker builder - set empty string to reset to default
    dockerfile_path: z.string().optional(), // Optional path to Dockerfile, if using docker builder - set empty string to reset to default
    environment_id: z.string(),
    git_branch: z.string().optional(),
    git_tag: z.string().optional(), // Tag to build from, supports glob patterns
    health_check: HealthCheckSchema.optional(),
    hosts: z.array(HostSpecSchema).nullable().optional(),
    image: z.string().optional(),
    install_command: z.string().optional(),
    is_public: z.boolean().optional(),
    name: z.string().nullable().optional(),
    ports: z.array(PortSpecSchema).nullable().optional(),
    project_id: z.string(),
    pvc_id: z.string().optional(), // ID of the PVC to attach to the service
    pvc_mount_path: z.string().optional(), // Mount path for the PVC
    replicas: z.number().optional(),
    run_command: z.string().optional(),
    s3_backup_bucket: z.string().optional(),
    s3_backup_source_id: z.string().optional(),
    service_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const UpdateStatusResponseBodySchema = z
  .object({
    ready: z.boolean(),
  })
  .strip();

export const UpdateTeamInputBodySchema = z
  .object({
    description: z.string().nullable(),
    name: z.string(),
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

export const VariableReferenceSourceSchema = z
  .object({
    key: z.string(),
    source_icon: z.string(),
    source_id: z.string(),
    source_kubernetes_name: z.string(),
    source_name: z.string(),
    source_type: VariableReferenceSourceTypeSchema,
    type: VariableReferenceTypeSchema,
  })
  .strip();

export const VariableReferenceInputItemSchema = z
  .object({
    name: z.string(), // The name of the target variable
    sources: z.array(VariableReferenceSourceSchema), // The sources to reference in the template interpolation
    value: z.string(), // The template for the value of the variable reference, e.g. 'https://${source_kubernetes_name.key}'
  })
  .strip();

export const UpsertVariablesInputBodySchema = z
  .object({
    behavior: VariableUpdateBehaviorSchema, // The behavior of the update - upsert or overwrite
    environment_id: z.string().optional(), // If present without service_id, mutate environment variables - requires project_id
    project_id: z.string().optional(), // If present without environment_id, mutate team variables
    service_id: z.string().optional(), // If present, mutate service variables - requires project_id and environment_id
    team_id: z.string(),
    type: VariableReferenceSourceTypeSchema, // The type of variable
    variable_references: z.array(VariableReferenceInputItemSchema).nullable().optional(),
    variables: z.array(ItemSchema).nullable(),
  })
  .strip();

export const VariableReferenceResponseSchema = z
  .object({
    created_at: z.string().datetime(),
    error: z.string().nullable().optional(),
    id: z.string(), // The ID of the variable reference
    name: z.string(),
    sources: z.array(VariableReferenceSourceSchema),
    target_service_id: z.string(),
    value: z.string(),
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
    variable_references: z.array(VariableReferenceResponseSchema),
    variables: z.array(VariableResponseItemSchema),
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
export type BuildkitSettings = z.infer<typeof BuildkitSettingsSchema>;
export type CallbackResponseBody = z.infer<typeof CallbackResponseBodySchema>;
export type Capabilities = z.infer<typeof CapabilitiesSchema>;
export type ContainerState = z.infer<typeof ContainerStateSchema>;
export type CreateBuildInputBody = z.infer<typeof CreateBuildInputBodySchema>;
export type GitCommitter = z.infer<typeof GitCommitterSchema>;
export type DeploymentStatus = z.infer<typeof DeploymentStatusSchema>;
export type DeploymentResponse = z.infer<typeof DeploymentResponseSchema>;
export type CreateBuildOutputBody = z.infer<typeof CreateBuildOutputBodySchema>;
export type CreateEnvironmentInput = z.infer<typeof CreateEnvironmentInputSchema>;
export type EnvironmentResponse = z.infer<typeof EnvironmentResponseSchema>;
export type CreateEnvironmentResponseBody = z.infer<typeof CreateEnvironmentResponseBodySchema>;
export type PvcScope = z.infer<typeof PvcScopeSchema>;
export type CreatePVCInput = z.infer<typeof CreatePVCInputSchema>;
export type PersistentVolumeClaimPhase = z.infer<typeof PersistentVolumeClaimPhaseSchema>;
export type PVCInfo = z.infer<typeof PVCInfoSchema>;
export type CreatePVCResponseBody = z.infer<typeof CreatePVCResponseBodySchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type CreateProjectResponseBody = z.infer<typeof CreateProjectResponseBodySchema>;
export type S3Bucket = z.infer<typeof S3BucketSchema>;
export type S3Response = z.infer<typeof S3ResponseSchema>;
export type CreateS3OutputBody = z.infer<typeof CreateS3OutputBodySchema>;
export type ServiceBuilder = z.infer<typeof ServiceBuilderSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type HealthCheckType = z.infer<typeof HealthCheckTypeSchema>;
export type HealthCheck = z.infer<typeof HealthCheckSchema>;
export type HostSpec = z.infer<typeof HostSpecSchema>;
export type Protocol = z.infer<typeof ProtocolSchema>;
export type PortSpec = z.infer<typeof PortSpecSchema>;
export type ServiceType = z.infer<typeof ServiceTypeSchema>;
export type CreateServiceInput = z.infer<typeof CreateServiceInputSchema>;
export type SecurityContext = z.infer<typeof SecurityContextSchema>;
export type VariableMount = z.infer<typeof VariableMountSchema>;
export type ServiceConfigResponse = z.infer<typeof ServiceConfigResponseSchema>;
export type TemplateInputType = z.infer<typeof TemplateInputTypeSchema>;
export type TemplateInput = z.infer<typeof TemplateInputSchema>;
export type TemplateVariableReference = z.infer<typeof TemplateVariableReferenceSchema>;
export type ValueHashType = z.infer<typeof ValueHashTypeSchema>;
export type JWTParams = z.infer<typeof JWTParamsSchema>;
export type GeneratorType = z.infer<typeof GeneratorTypeSchema>;
export type ValueGenerator = z.infer<typeof ValueGeneratorSchema>;
export type TemplateVariable = z.infer<typeof TemplateVariableSchema>;
export type TemplateVolumeSize = z.infer<typeof TemplateVolumeSizeSchema>;
export type TemplateVolume = z.infer<typeof TemplateVolumeSchema>;
export type TemplateService = z.infer<typeof TemplateServiceSchema>;
export type TemplateDefinition = z.infer<typeof TemplateDefinitionSchema>;
export type TemplateWithDefinitionResponse = z.infer<typeof TemplateWithDefinitionResponseSchema>;
export type ServiceResponse = z.infer<typeof ServiceResponseSchema>;
export type CreateServiceResponseBody = z.infer<typeof CreateServiceResponseBodySchema>;
export type CreateUserInputBody = z.infer<typeof CreateUserInputBodySchema>;
export type UserData = z.infer<typeof UserDataSchema>;
export type CreateUserResponseBody = z.infer<typeof CreateUserResponseBodySchema>;
export type WebhookTeamEvent = z.infer<typeof WebhookTeamEventSchema>;
export type WebhookProjectEvent = z.infer<typeof WebhookProjectEventSchema>;
export type WebhookType = z.infer<typeof WebhookTypeSchema>;
export type WebhookResponse = z.infer<typeof WebhookResponseSchema>;
export type CreateWebhookResponseBody = z.infer<typeof CreateWebhookResponseBodySchema>;
export type DatabaseConfigurable = z.infer<typeof DatabaseConfigurableSchema>;
export type DatabaseConfigurables = z.infer<typeof DatabaseConfigurablesSchema>;
export type DeleteEnvironmentInputBody = z.infer<typeof DeleteEnvironmentInputBodySchema>;
export type DeletedResponse = z.infer<typeof DeletedResponseSchema>;
export type DeleteEnvironmentResponseBody = z.infer<typeof DeleteEnvironmentResponseBodySchema>;
export type DeletePVCInput = z.infer<typeof DeletePVCInputSchema>;
export type DeletePVCResponseBody = z.infer<typeof DeletePVCResponseBodySchema>;
export type DeleteProjectInputBody = z.infer<typeof DeleteProjectInputBodySchema>;
export type DeleteProjectResponseBody = z.infer<typeof DeleteProjectResponseBodySchema>;
export type DeleteS3SourceByIDInputBody = z.infer<typeof DeleteS3SourceByIDInputBodySchema>;
export type DeleteS3SourceByIDOutputBody = z.infer<typeof DeleteS3SourceByIDOutputBodySchema>;
export type DeleteServiceInputBody = z.infer<typeof DeleteServiceInputBodySchema>;
export type DeleteServiceResponseBody = z.infer<typeof DeleteServiceResponseBodySchema>;
export type VariableDeleteInput = z.infer<typeof VariableDeleteInputSchema>;
export type DeleteVariablesInputBody = z.infer<typeof DeleteVariablesInputBodySchema>;
export type DeleteWebhookInputBody = z.infer<typeof DeleteWebhookInputBodySchema>;
export type DeleteWebhookResponseBody = z.infer<typeof DeleteWebhookResponseBodySchema>;
export type DnsCheck = z.infer<typeof DnsCheckSchema>;
export type DnsCheckResponseBody = z.infer<typeof DnsCheckResponseBodySchema>;
export type ExtendedHostSpec = z.infer<typeof ExtendedHostSpecSchema>;
export type IngressEndpoint = z.infer<typeof IngressEndpointSchema>;
export type ServiceEndpoint = z.infer<typeof ServiceEndpointSchema>;
export type EndpointDiscovery = z.infer<typeof EndpointDiscoverySchema>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type ErrorModel = z.infer<typeof ErrorModelSchema>;
export type GetDatabaseResponseBody = z.infer<typeof GetDatabaseResponseBodySchema>;
export type GetDeploymentResponseBody = z.infer<typeof GetDeploymentResponseBodySchema>;
export type GetEnvironmentOutputBody = z.infer<typeof GetEnvironmentOutputBodySchema>;
export type InstanceHealth = z.infer<typeof InstanceHealthSchema>;
export type SimpleInstanceStatus = z.infer<typeof SimpleInstanceStatusSchema>;
export type SimpleHealthStatus = z.infer<typeof SimpleHealthStatusSchema>;
export type GetInstanceHealthResponseBody = z.infer<typeof GetInstanceHealthResponseBodySchema>;
export type MetricsType = z.infer<typeof MetricsTypeSchema>;
export type MetricDetail = z.infer<typeof MetricDetailSchema>;
export type MetricsMapEntry = z.infer<typeof MetricsMapEntrySchema>;
export type MetricsResult = z.infer<typeof MetricsResultSchema>;
export type GetMetricsResponseBody = z.infer<typeof GetMetricsResponseBodySchema>;
export type NodeMetricsMapEntry = z.infer<typeof NodeMetricsMapEntrySchema>;
export type NodeMetricsResult = z.infer<typeof NodeMetricsResultSchema>;
export type GetNodeMetricsResponseBody = z.infer<typeof GetNodeMetricsResponseBodySchema>;
export type GetPVCResponseBody = z.infer<typeof GetPVCResponseBodySchema>;
export type GetProjectResponseBody = z.infer<typeof GetProjectResponseBodySchema>;
export type GetS3SourceByIDOutputBody = z.infer<typeof GetS3SourceByIDOutputBodySchema>;
export type GetServiceResponseBody = z.infer<typeof GetServiceResponseBodySchema>;
export type TeamResponse = z.infer<typeof TeamResponseSchema>;
export type GetTeamResponseBody = z.infer<typeof GetTeamResponseBodySchema>;
export type GetTemplateResponseBody = z.infer<typeof GetTemplateResponseBodySchema>;
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
export type GithubAppGetResponseBody = z.infer<typeof GithubAppGetResponseBodySchema>;
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
export type InstanceStatus = z.infer<typeof InstanceStatusSchema>;
export type InstanceType = z.infer<typeof InstanceTypeSchema>;
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
export type ListPVCResponseBody = z.infer<typeof ListPVCResponseBodySchema>;
export type ListProjectResponseBody = z.infer<typeof ListProjectResponseBodySchema>;
export type ListS3SourceOutputBody = z.infer<typeof ListS3SourceOutputBodySchema>;
export type ListServiceResponseBody = z.infer<typeof ListServiceResponseBodySchema>;
export type TemplateShortResponse = z.infer<typeof TemplateShortResponseSchema>;
export type ListTemplatesResponseBody = z.infer<typeof ListTemplatesResponseBodySchema>;
export type ListWebhooksResponseBody = z.infer<typeof ListWebhooksResponseBodySchema>;
export type LogMetadata = z.infer<typeof LogMetadataSchema>;
export type LogEvent = z.infer<typeof LogEventSchema>;
export type LogEventsMessageType = z.infer<typeof LogEventsMessageTypeSchema>;
export type LogEvents = z.infer<typeof LogEventsSchema>;
export type LogType = z.infer<typeof LogTypeSchema>;
export type LoginForm = z.infer<typeof LoginFormSchema>;
export type LokiDirection = z.infer<typeof LokiDirectionSchema>;
export type UserAPIResponse = z.infer<typeof UserAPIResponseSchema>;
export type MeResponseBody = z.infer<typeof MeResponseBodySchema>;
export type QueryLogsResponseBody = z.infer<typeof QueryLogsResponseBodySchema>;
export type RedeployInputBody = z.infer<typeof RedeployInputBodySchema>;
export type RedeployOutputBody = z.infer<typeof RedeployOutputBodySchema>;
export type ReferenceableVariablesResponseBody = z.infer<
  typeof ReferenceableVariablesResponseBodySchema
>;
export type ResolveAvailableVariableReferenceResponseBody = z.infer<
  typeof ResolveAvailableVariableReferenceResponseBodySchema
>;
export type ResolveVariableReferenceResponseBody = z.infer<
  typeof ResolveVariableReferenceResponseBodySchema
>;
export type RestartInstancesInputBody = z.infer<typeof RestartInstancesInputBodySchema>;
export type Restarted = z.infer<typeof RestartedSchema>;
export type RestartServicesResponseBody = z.infer<typeof RestartServicesResponseBodySchema>;
export type S3BackendCreateInput = z.infer<typeof S3BackendCreateInputSchema>;
export type S3TestResult = z.infer<typeof S3TestResultSchema>;
export type SystemSettingsResponse = z.infer<typeof SystemSettingsResponseSchema>;
export type SettingsResponseBody = z.infer<typeof SettingsResponseBodySchema>;
export type SetupData = z.infer<typeof SetupDataSchema>;
export type SetupStatusResponseBody = z.infer<typeof SetupStatusResponseBodySchema>;
export type SortByField = z.infer<typeof SortByFieldSchema>;
export type SortOrder = z.infer<typeof SortOrderSchema>;
export type SystemMeta = z.infer<typeof SystemMetaSchema>;
export type SystemMetaResponseBody = z.infer<typeof SystemMetaResponseBodySchema>;
export type SystemSettingUpdateInput = z.infer<typeof SystemSettingUpdateInputSchema>;
export type TeamResponseBody = z.infer<typeof TeamResponseBodySchema>;
export type TemplateInputValue = z.infer<typeof TemplateInputValueSchema>;
export type TemplateDeployInput = z.infer<typeof TemplateDeployInputSchema>;
export type TemplateDeployResponseBody = z.infer<typeof TemplateDeployResponseBodySchema>;
export type TestS3AccessInputBody = z.infer<typeof TestS3AccessInputBodySchema>;
export type TestS3OutputBody = z.infer<typeof TestS3OutputBodySchema>;
export type UpdatServiceResponseBody = z.infer<typeof UpdatServiceResponseBodySchema>;
export type UpdateApplyInputBody = z.infer<typeof UpdateApplyInputBodySchema>;
export type UpdateApplyResponseBody = z.infer<typeof UpdateApplyResponseBodySchema>;
export type UpdateCheckResponseBody = z.infer<typeof UpdateCheckResponseBodySchema>;
export type UpdateEnvironmentInput = z.infer<typeof UpdateEnvironmentInputSchema>;
export type UpdateEnvironmentResponseBody = z.infer<typeof UpdateEnvironmentResponseBodySchema>;
export type UpdatePVCInput = z.infer<typeof UpdatePVCInputSchema>;
export type UpdatePVCResponseBody = z.infer<typeof UpdatePVCResponseBodySchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;
export type UpdateProjectResponseBody = z.infer<typeof UpdateProjectResponseBodySchema>;
export type UpdateS3SourceInputBody = z.infer<typeof UpdateS3SourceInputBodySchema>;
export type UpdateS3SourceResponseBody = z.infer<typeof UpdateS3SourceResponseBodySchema>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceInputSchema>;
export type UpdateStatusResponseBody = z.infer<typeof UpdateStatusResponseBodySchema>;
export type UpdateTeamInputBody = z.infer<typeof UpdateTeamInputBodySchema>;
export type UpdateTeamResponseBody = z.infer<typeof UpdateTeamResponseBodySchema>;
export type UpdateWebhookResponseBody = z.infer<typeof UpdateWebhookResponseBodySchema>;
export type VariableUpdateBehavior = z.infer<typeof VariableUpdateBehaviorSchema>;
export type VariableReferenceSource = z.infer<typeof VariableReferenceSourceSchema>;
export type VariableReferenceInputItem = z.infer<typeof VariableReferenceInputItemSchema>;
export type UpsertVariablesInputBody = z.infer<typeof UpsertVariablesInputBodySchema>;
export type VariableReferenceResponse = z.infer<typeof VariableReferenceResponseSchema>;
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

export const get_github_appQuerySchema = z
  .object({
    uuid: z.string(),
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

export const get_instance_healthQuerySchema = z
  .object({
    team_id: z.string(),
    project_id: z.string(),
    environment_id: z.string(),
    service_id: z.string(),
  })
  .passthrough();

export const list_instancesQuerySchema = z
  .object({
    type: InstanceTypeSchema,
    team_id: z.string(),
    project_id: z.string().optional(),
    environment_id: z.string().optional(),
    service_id: z.string().optional(),
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

export const get_pvcQuerySchema = z
  .object({
    type: PvcScopeSchema,
    team_id: z.string(),
    project_id: z.string().optional(),
    environment_id: z.string().optional(),
    id: z.string(),
  })
  .passthrough();

export const list_pvcQuerySchema = z
  .object({
    type: PvcScopeSchema,
    team_id: z.string(),
    project_id: z.string().optional(),
    environment_id: z.string().optional(),
  })
  .passthrough();

export const get_s3_source_by_idQuerySchema = z
  .object({
    id: z.string(),
    team_id: z.string(),
    with_buckets: z.boolean().optional(),
  })
  .passthrough();

export const list_s3_sourcesQuerySchema = z
  .object({
    team_id: z.string(),
    with_buckets: z.boolean().optional(),
  })
  .passthrough();

export const check_dns_resolutionQuerySchema = z
  .object({
    domain: z.string(),
  })
  .passthrough();

export const get_teamQuerySchema = z
  .object({
    team_id: z.string(),
  })
  .passthrough();

export const get_templateQuerySchema = z
  .object({
    id: z.string(),
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

export const read_available_variable_referenceQuerySchema = z
  .object({
    team_id: z.string().optional(),
    type: VariableReferenceTypeSchema.optional(),
    name: z.string().optional(),
    source_type: VariableReferenceSourceTypeSchema.optional(),
    source_id: z.string().optional(),
    key: z.string().optional(),
  })
  .passthrough();

export const read_variable_referenceQuerySchema = z
  .object({
    service_id: z.string(),
    reference_id: z.string(),
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
      dev_login: async (params?: undefined, fetchOptions?: RequestInit) => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/auth/dev_login`);

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
      login: async (params: LoginForm, fetchOptions?: RequestInit) => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/auth/login`);

          const options: RequestInit = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = LoginFormSchema.parse(params);
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
      redeploy: async (
        params: RedeployInputBody,
        fetchOptions?: RequestInit,
      ): Promise<RedeployOutputBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/deployments/redeploy`);

          const options: RequestInit = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = RedeployInputBodySchema.parse(params);
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
          return RedeployOutputBodySchema.parse(data);
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
        get: async (
          params: z.infer<typeof get_github_appQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<GithubAppGetResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/github/app/get`);
            const validatedQuery = get_github_appQuerySchema.parse(params);
            const queryKeys = ['uuid'];
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
            return GithubAppGetResponseBodySchema.parse(data);
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
      health: async (
        params: z.infer<typeof get_instance_healthQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetInstanceHealthResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/instances/health`);
          const validatedQuery = get_instance_healthQuerySchema.parse(params);
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
          return GetInstanceHealthResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      list: async (
        params: z.infer<typeof list_instancesQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<ListInstancesResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/instances/list`);
          const validatedQuery = list_instancesQuerySchema.parse(params);
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
        params: CreateProjectInput,
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
          const validatedBody = CreateProjectInputSchema.parse(params);
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
        params: UpdateProjectInput,
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
          const validatedBody = UpdateProjectInputSchema.parse(params);
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
    setup: {
      createUser: async (
        params: CreateUserInputBody,
        fetchOptions?: RequestInit,
      ): Promise<CreateUserResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/setup/create-user`);

          const options: RequestInit = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = CreateUserInputBodySchema.parse(params);
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
          return CreateUserResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      status: async (
        params?: undefined,
        fetchOptions?: RequestInit,
      ): Promise<SetupStatusResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/setup/status`);

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
          return SetupStatusResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    storage: {
      pvc: {
        create: async (
          params: CreatePVCInput,
          fetchOptions?: RequestInit,
        ): Promise<CreatePVCResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/storage/pvc/create`);

            const options: RequestInit = {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };
            const validatedBody = CreatePVCInputSchema.parse(params);
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
            return CreatePVCResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        delete: async (
          params: DeletePVCInput,
          fetchOptions?: RequestInit,
        ): Promise<DeletePVCResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/storage/pvc/delete`);

            const options: RequestInit = {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };
            const validatedBody = DeletePVCInputSchema.parse(params);
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
            return DeletePVCResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        get: async (
          params: z.infer<typeof get_pvcQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<GetPVCResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/storage/pvc/get`);
            const validatedQuery = get_pvcQuerySchema.parse(params);
            const queryKeys = ['type', 'team_id', 'project_id', 'environment_id', 'id'];
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
            return GetPVCResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        list: async (
          params: z.infer<typeof list_pvcQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<ListPVCResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/storage/pvc/list`);
            const validatedQuery = list_pvcQuerySchema.parse(params);
            const queryKeys = ['type', 'team_id', 'project_id', 'environment_id'];
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
            return ListPVCResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        update: async (
          params: UpdatePVCInput,
          fetchOptions?: RequestInit,
        ): Promise<UpdatePVCResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/storage/pvc/update`);

            const options: RequestInit = {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };
            const validatedBody = UpdatePVCInputSchema.parse(params);
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
            return UpdatePVCResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
      },
      s3: {
        create: async (
          params: S3BackendCreateInput,
          fetchOptions?: RequestInit,
        ): Promise<CreateS3OutputBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/storage/s3/create`);

            const options: RequestInit = {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };
            const validatedBody = S3BackendCreateInputSchema.parse(params);
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
            return CreateS3OutputBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        delete: async (
          params: DeleteS3SourceByIDInputBody,
          fetchOptions?: RequestInit,
        ): Promise<DeleteS3SourceByIDOutputBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/storage/s3/delete`);

            const options: RequestInit = {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };
            const validatedBody = DeleteS3SourceByIDInputBodySchema.parse(params);
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
            return DeleteS3SourceByIDOutputBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        get: async (
          params: z.infer<typeof get_s3_source_by_idQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<GetS3SourceByIDOutputBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/storage/s3/get`);
            const validatedQuery = get_s3_source_by_idQuerySchema.parse(params);
            const queryKeys = ['id', 'team_id', 'with_buckets'];
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
            return GetS3SourceByIDOutputBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        list: async (
          params: z.infer<typeof list_s3_sourcesQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<ListS3SourceOutputBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/storage/s3/list`);
            const validatedQuery = list_s3_sourcesQuerySchema.parse(params);
            const queryKeys = ['team_id', 'with_buckets'];
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
            return ListS3SourceOutputBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        test: async (
          params: TestS3AccessInputBody,
          fetchOptions?: RequestInit,
        ): Promise<TestS3OutputBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/storage/s3/test`);

            const options: RequestInit = {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };
            const validatedBody = TestS3AccessInputBodySchema.parse(params);
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
            return TestS3OutputBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        update: async (
          params: UpdateS3SourceInputBody,
          fetchOptions?: RequestInit,
        ): Promise<UpdateS3SourceResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/storage/s3/update`);

            const options: RequestInit = {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };
            const validatedBody = UpdateS3SourceInputBodySchema.parse(params);
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
            return UpdateS3SourceResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
      },
    },
    system: {
      dns: {
        check: async (
          params: z.infer<typeof check_dns_resolutionQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<DnsCheckResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/system/dns/check`);
            const validatedQuery = check_dns_resolutionQuerySchema.parse(params);
            const queryKeys = ['domain'];
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
            return DnsCheckResponseBodySchema.parse(data);
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
      settings: {
        update: async (
          params: SystemSettingUpdateInput,
          fetchOptions?: RequestInit,
        ): Promise<SettingsResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/system/settings/update`);

            const options: RequestInit = {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };
            const validatedBody = SystemSettingUpdateInputSchema.parse(params);
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
            return SettingsResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
      },
      update: {
        apply: async (
          params: UpdateApplyInputBody,
          fetchOptions?: RequestInit,
        ): Promise<UpdateApplyResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/system/update/apply`);

            const options: RequestInit = {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };
            const validatedBody = UpdateApplyInputBodySchema.parse(params);
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
            return UpdateApplyResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        check: async (
          params?: undefined,
          fetchOptions?: RequestInit,
        ): Promise<UpdateCheckResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/system/update/check`);

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
            return UpdateCheckResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        status: async (
          params?: undefined,
          fetchOptions?: RequestInit,
        ): Promise<UpdateStatusResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/system/update/status`);

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
            return UpdateStatusResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
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
    templates: {
      deploy: async (
        params: TemplateDeployInput,
        fetchOptions?: RequestInit,
      ): Promise<TemplateDeployResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/templates/deploy`);

          const options: RequestInit = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            ...fetchOptions,
          };
          const validatedBody = TemplateDeployInputSchema.parse(params);
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
          return TemplateDeployResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      get: async (
        params: z.infer<typeof get_templateQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetTemplateResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/templates/get`);
          const validatedQuery = get_templateQuerySchema.parse(params);
          const queryKeys = ['id'];
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
          return GetTemplateResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      list: async (
        params?: undefined,
        fetchOptions?: RequestInit,
      ): Promise<ListTemplatesResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(`${apiUrl}/templates/list`);

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
          return ListTemplatesResponseBodySchema.parse(data);
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
        available: Object.assign(
          async (
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
          {
            get: async (
              params: z.infer<typeof read_available_variable_referenceQuerySchema>,
              fetchOptions?: RequestInit,
            ): Promise<ResolveAvailableVariableReferenceResponseBody> => {
              try {
                if (!apiUrl || typeof apiUrl !== 'string') {
                  throw new Error('API URL is undefined or not a string');
                }
                const url = new URL(`${apiUrl}/variables/references/available/get`);
                const validatedQuery = read_available_variable_referenceQuerySchema.parse(params);
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
                return ResolveAvailableVariableReferenceResponseBodySchema.parse(data);
              } catch (error) {
                console.error('Error in API request:', error);
                throw error;
              }
            },
          },
        ),
      },
      referneces: {
        get: async (
          params: z.infer<typeof read_variable_referenceQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<ResolveVariableReferenceResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(`${apiUrl}/variables/referneces/get`);
            const validatedQuery = read_variable_referenceQuerySchema.parse(params);
            const queryKeys = ['service_id', 'reference_id'];
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
