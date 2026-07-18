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

export const CapabilitiesSchema = z
  .object({
    add: z.array(z.string()).nullable().optional(),
    drop: z.array(z.string()).nullable().optional(),
  })
  .strip();

export const CertManagerConditionSchema = z.enum(['Ready', 'InvalidRequest', 'Approved', 'Denied']);

export const CollisionOutputSchema = z
  .object({
    is_unique: z.boolean(), // True if the domain is unique, false otherwise
  })
  .strip();

export const CheckUniqueDomainOutputBodySchema = z
  .object({
    data: CollisionOutputSchema, // The generated wildcard domain
  })
  .strip();

export const ContainerStateSchema = z.enum([
  'running',
  'waiting',
  'terminated',
  'terminating',
  'crashing',
  'not_ready',
  'image_pull_error',
  'starting',
]);

export const ConvexAdminKeyParamsSchema = z
  .object({
    AdminKeyOutputKey: z.string(),
    InstanceName: z.string(),
    SecretOutputKey: z.string(),
  })
  .strip();

export const CookieSchema = z
  .object({
    Domain: z.string(),
    Expires: z.string().datetime({ offset: true }),
    HttpOnly: z.boolean(),
    MaxAge: z.number(),
    Name: z.string(),
    Partitioned: z.boolean(),
    Path: z.string(),
    Quoted: z.boolean(),
    Raw: z.string(),
    RawExpires: z.string(),
    SameSite: z.number(),
    Secure: z.boolean(),
    Unparsed: z.array(z.string()).nullable(),
    Value: z.string(),
  })
  .strip();

export const CreateBuildInputBodySchema = z
  .object({
    environment_id: z.string(),
    git_sha: z.string().nullable().optional(), // The git sha of the deployment
    project_id: z.string(),
    service_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const ServiceBuilderSchema = z.enum(['railpack', 'docker', 'database']);

export const GitCommitterSchema = z
  .object({
    avatar_url: z.string(),
    name: z.string(),
  })
  .strip();

export const EventTypeSchema = z.enum([
  'oom_killed',
  'crash_loop_back_off',
  'container_created',
  'container_started',
  'container_stopped',
  'image_pull_back_off',
  'node_not_ready',
  'scheduling_failed',
  'unknown',
]);

export const EventRecordSchema = z
  .object({
    count: z.number().optional(),
    first_seen: z.string().optional(),
    last_seen: z.string().optional(),
    message: z.string().optional(),
    reason: z.string().optional(),
    timestamp: z.string(),
    type: EventTypeSchema,
  })
  .strip();

export const DeploymentStatusSchema = z.enum([
  'build-pending',
  'build-queued',
  'build-running',
  'build-succeeded',
  'build-cancelled',
  'build-failed',
  'active',
  'launching',
  'launch-error',
  'crashing',
  'removed',
]);

export const DeploymentResponseSchema = z
  .object({
    attempts: z.number(),
    builder: ServiceBuilderSchema,
    commit_author: GitCommitterSchema.optional(),
    commit_message: z.string().optional(),
    commit_sha: z.string().optional(),
    completed_at: z.string().datetime({ offset: true }).optional(),
    crashing_reasons: z.array(z.string()),
    created_at: z.string().datetime({ offset: true }),
    docker_builder_build_context: z.string().optional(),
    docker_builder_dockerfile_path: z.string().optional(),
    error: z.string().optional(),
    git_branch: z.string().optional(),
    id: z.string(),
    image: z.string().optional(),
    instance_events: z.array(EventRecordSchema),
    instance_restarts: z.number(),
    job_name: z.string(),
    queued_at: z.string().datetime({ offset: true }).optional(),
    railpack_builder_build_command: z.string().optional(),
    railpack_builder_install_command: z.string().optional(),
    run_command: z.string().optional(),
    service_id: z.string(),
    started_at: z.string().datetime({ offset: true }).optional(),
    status: DeploymentStatusSchema,
    updated_at: z.string().datetime({ offset: true }),
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

export const PermittedActionSchema = z.enum(['admin', 'edit', 'view']);

export const EnvironmentResponseSchema = z
  .object({
    active: z.boolean(),
    created_at: z.string().datetime({ offset: true }),
    description: z.string(),
    id: z.string(),
    kubernetes_name: z.string(),
    name: z.string(),
    permissions: z.array(PermittedActionSchema), // Actions the current user can perform on this resource
    service_count: z.number().optional(),
    service_icons: z.array(z.string()).optional(),
  })
  .strip();

export const CreateEnvironmentResponseBodySchema = z
  .object({
    data: EnvironmentResponseSchema,
  })
  .strip();

export const CreateGroupInputBodySchema = z
  .object({
    description: z.string(),
    name: z.string(),
  })
  .strip();

export const GroupResponseSchema = z
  .object({
    created_at: z.string().datetime({ offset: true }),
    description: z.string(),
    id: z.string(),
    name: z.string(),
  })
  .strip();

export const CreateGroupResponseBodySchema = z
  .object({
    data: GroupResponseSchema,
  })
  .strip();

export const PvcScopeSchema = z.enum(['team', 'project', 'environment']);

export const CreatePVCInputSchema = z
  .object({
    capacity_gb: z.number(),
    description: z.string().optional(),
    environment_id: z.string().optional(),
    name: z.string(),
    project_id: z.string().optional(),
    team_id: z.string(),
    type: PvcScopeSchema,
  })
  .strip();

export const PersistentVolumeClaimPhaseSchema = z.enum(['Pending', 'Bound', 'Lost']);

export const PVCInfoSchema = z
  .object({
    can_delete: z.boolean(),
    capacity_gb: z.number(),
    created_at: z.string().datetime({ offset: true }),
    description: z.string().optional(),
    environment_id: z.string().optional(),
    id: z.string(),
    is_available: z.boolean(),
    is_database: z.boolean(),
    is_pending_resize: z.boolean(),
    mount_path: z.string().optional(),
    mounted_on_service_id: z.string().optional(),
    name: z.string(),
    project_id: z.string().optional(),
    status: PersistentVolumeClaimPhaseSchema,
    team_id: z.string(),
    type: PvcScopeSchema,
    used_gb: z.number().optional(),
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
    created_at: z.string().datetime({ offset: true }),
    default_environment_id: z.string().optional(),
    description: z.string().nullable(),
    environment_count: z.number(),
    environments: z.array(EnvironmentResponseSchema),
    id: z.string(),
    kubernetes_name: z.string(),
    name: z.string(),
    permissions: z.array(PermittedActionSchema), // Actions the current user can perform on this resource
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

export const CreateRegistryInputSchema = z
  .object({
    host: z.string(),
    password: z.string(),
    username: z.string(),
  })
  .strip();

export const RegistryResponseSchema = z
  .object({
    Host: z.string(),
    id: z.string(),
    username: z.string(),
  })
  .strip();

export const CreateRegistryResponseBodySchema = z
  .object({
    data: RegistryResponseSchema,
  })
  .strip();

export const S3BucketSchema = z
  .object({
    bucket_region: z.string(),
    created_at: z.string().datetime({ offset: true }),
    name: z.string(),
  })
  .strip();

export const S3ResponseSchema = z
  .object({
    access_key: z.string(),
    buckets: z.array(S3BucketSchema),
    created_at: z.string().datetime({ offset: true }),
    endpoint: z.string(),
    id: z.string(),
    name: z.string(),
    region: z.string(),
    secret_key: z.string(),
    updated_at: z.string().datetime({ offset: true }),
  })
  .strip();

export const CreateS3OutputBodySchema = z
  .object({
    data: S3ResponseSchema,
  })
  .strip();

export const CreateServiceGroupInputSchema = z
  .object({
    description: z.string().optional(), // The description of the service group
    environment_id: z.string(),
    icon: z.string().optional(), // The icon of the service group
    name: z.string(), // The name of the service group
    project_id: z.string(),
    team_id: z.string(),
  })
  .strip();

export const ServiceGroupResponseSchema = z
  .object({
    created_at: z.string().datetime({ offset: true }),
    description: z.string().optional(),
    environment_id: z.string(),
    icon: z.string().optional(),
    id: z.string(),
    name: z.string(),
    template_id: z.string().optional(), // Set when the group was created by deploying a template
  })
  .strip();

export const CreateServiceGroupResponseBodySchema = z
  .object({
    data: ServiceGroupResponseSchema,
  })
  .strip();

export const DatabaseConfigSchema = z
  .object({
    defaultDatabaseName: z.string().optional(),
    initdb: z.string().optional(),
    storage: z.string().optional(),
    version: z.string().optional(),
    walLevel: z.string().optional(),
  })
  .strip();

export const HealthCheckTypeSchema = z.enum(['http', 'exec', 'none']);

export const HealthCheckSchema = z
  .object({
    command: z.string().optional(), // Command for exec health checks
    health_failure_threshold: z.number().optional(), // Failure threshold for health probes
    health_period_seconds: z.number().optional(), // How often to perform the health probe
    health_timeout_seconds: z.number().optional(), // How long to wait before marking the health probe as failed
    path: z.string().optional(), // Path for http health checks
    port: z.number().optional(), // Port for http health checks
    startup_failure_threshold: z.number().optional(), // Failure threshold for startup probes
    startup_period_seconds: z.number().optional(), // How often to perform the startup probe
    startup_timeout_seconds: z.number().optional(), // How long to wait before marking the startup probe as failed
    type: HealthCheckTypeSchema.optional(),
  })
  .strip();

export const HostSpecSchema = z
  .object({
    description: z.string().optional(),
    display_name: z.string().optional(), // Human label from the template input, e.g. Cloud Domain
    host: z.string(),
    path: z.string(),
    prev_host: z.string().optional(), // Previous host for the service, used for upserting key
    protocol: z.string().optional(), // Application protocol for the domain: http (default) or grpc
    target_port: z.number().optional(),
    template_input_id: z.string().optional(),
  })
  .strip();

export const InitContainerSchema = z
  .object({
    command: z.string(), // Command to run in the init container
    image: z.string(), // Image of the init container
  })
  .strip();

export const ProtocolSchema = z.enum(['TCP', 'UDP', 'SCTP']);

export const PortSpecSchema = z
  .object({
    is_nodeport: z.boolean().optional(),
    node_port: z.number().optional(),
    port: z.number(),
    protocol: ProtocolSchema.optional(),
  })
  .strip();

export const ResourcesSchema = z
  .object({
    cpu_limits_millicores: z.number().optional(),
    cpu_requests_millicores: z.number().optional(),
    memory_limits_megabytes: z.number().optional(),
    memory_requests_megabytes: z.number().optional(),
  })
  .strip();

export const ServiceTypeSchema = z.enum(['github', 'docker-image', 'database']);

export const VariableMountSchema = z
  .object({
    name: z.string(), // Name of the variable to mount
    path: z.string(), // Path to mount the variable (e.g. /etc/secret)
  })
  .strip();

export const ServiceVolumeSchema = z
  .object({
    id: z.string(), // ID of the volume, pvc name in kubernetes
    mount_path: z.string(), // Path to mount the volume (e.g. /mnt/data)
  })
  .strip();

export const CreateServiceInputSchema = z
  .object({
    auto_deploy: z.boolean().optional(),
    backup_retention: z.number().optional(), // Number of base backups to retain, e.g. 3
    backup_schedule: z.string().optional(), // Cron expression for the backup schedule, e.g. '0 0 * * *'
    builder: ServiceBuilderSchema, // Builder of the service - docker, nixpacks, railpack
    database_config: DatabaseConfigSchema.optional(),
    database_type: z.string().optional(),
    description: z.string().optional(),
    docker_builder_build_context: z.string().optional(), // Optional path to Dockerfile context, if using docker builder
    docker_builder_dockerfile_path: z.string().optional(), // Optional path to Dockerfile, if using docker builder
    environment_id: z.string(),
    github_installation_id: z.number().optional(),
    health_check: HealthCheckSchema.optional(), // Health check configuration for the service
    hosts: z.array(HostSpecSchema).nullable().optional(),
    image: z.string().optional(),
    init_containers: z.array(InitContainerSchema).nullable().optional(), // Init containers to run before the main container
    is_public: z.boolean().optional(),
    name: z.string(),
    ports: z.array(PortSpecSchema).nullable().optional(),
    project_id: z.string(),
    railpack_builder_build_command: z.string().optional(),
    railpack_builder_install_command: z.string().optional(),
    replicas: z.number().optional(),
    repository_name: z.string().optional(),
    repository_owner: z.string().optional(),
    resources: ResourcesSchema.optional(), // Resource limits and requests for the service containers
    run_command: z.string().optional(),
    s3_backup_bucket: z.string().optional(),
    s3_backup_source_id: z.string().optional(),
    team_id: z.string(),
    type: ServiceTypeSchema, // Type of service, e.g. 'github', 'docker-image'
    variable_mounts: z.array(VariableMountSchema).nullable().optional(), // Mount variables as volumes
    volumes: z.array(ServiceVolumeSchema).nullable().optional(), // Volumes to mount in the service
  })
  .strip();

export const SecurityContextSchema = z
  .object({
    capabilities: CapabilitiesSchema.optional(),
    privileged: z.boolean().optional(),
  })
  .strip();

export const ServiceConfigResponseSchema = z
  .object({
    auto_deploy: z.boolean(),
    backup_retention_count: z.number(),
    backup_schedule: z.string(),
    builder: ServiceBuilderSchema,
    docker_builder_build_context: z.string().optional(),
    docker_builder_dockerfile_path: z.string().optional(),
    git_branch: z.string().optional(),
    git_tag: z.string().optional(),
    health_check: HealthCheckSchema.optional(),
    hosts: z.array(HostSpecSchema),
    icon: z.string(),
    image: z.string().optional(),
    init_containers: z.array(InitContainerSchema),
    is_public: z.boolean(),
    ports: z.array(PortSpecSchema),
    protected_variables: z.array(z.string()),
    railpack_builder_build_command: z.string().optional(),
    railpack_builder_install_command: z.string().optional(),
    replicas: z.number(),
    resources: ResourcesSchema.optional(),
    run_command: z.string().optional(),
    s3_backup_bucket: z.string().optional(),
    s3_backup_source_id: z.string().optional(),
    security_context: SecurityContextSchema.optional(),
    variable_mounts: z.array(VariableMountSchema),
    volumes: z.array(PVCInfoSchema),
  })
  .strip();

export const TemplateResourceRecommendationsSchema = z
  .object({
    minimum_cpus: z.number(),
    minimum_ram_gb: z.number(),
  })
  .strip();

export const TemplateShortResponseSchema = z
  .object({
    created_at: z.string().datetime({ offset: true }),
    description: z.string(),
    display_rank: z.number(),
    icon: z.string(),
    id: z.string(),
    immutable: z.boolean(),
    keywords: z.array(z.string()),
    name: z.string(),
    resource_recommendations: TemplateResourceRecommendationsSchema.optional(),
    version: z.number(),
  })
  .strip();

export const ServiceResponseSchema = z
  .object({
    config: ServiceConfigResponseSchema,
    created_at: z.string().datetime({ offset: true }),
    current_deployment: DeploymentResponseSchema.optional(),
    database_type: z.string().optional(),
    database_version: z.string().optional(),
    description: z.string(),
    detected_ports: z.array(PortSpecSchema),
    environment_id: z.string(),
    git_repository: z.string().optional(),
    git_repository_owner: z.string().optional(),
    github_installation_id: z.number().optional(),
    id: z.string(),
    kubernetes_name: z.string(),
    last_deployment: DeploymentResponseSchema.optional(),
    last_successful_deployment: DeploymentResponseSchema.optional(),
    name: z.string(),
    permissions: z.array(PermittedActionSchema), // Actions the current user can perform on this resource
    service_group: ServiceGroupResponseSchema.optional(),
    template: TemplateShortResponseSchema.optional(),
    template_instance_id: z.string().optional(),
    type: ServiceTypeSchema,
    updated_at: z.string().datetime({ offset: true }),
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
    created_at: z.string().datetime({ offset: true }),
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

export const DNSStatusSchema = z.enum(['unknown', 'resolved', 'unresolved']);

export const DataStructSchema = z
  .object({
    success: z.boolean(),
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

export const DeleteGroupInputBodySchema = z
  .object({
    group_id: z.string(),
  })
  .strip();

export const DeleteGroupResponseBodySchema = z
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

export const DeleteRegistryInputSchema = z
  .object({
    id: z.string(),
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

export const DeleteServiceGroupInputSchema = z
  .object({
    delete_services: z.boolean().optional(), // Whether to delete the services in the service group
    environment_id: z.string(), // The ID of the environment
    id: z.string(), // The ID of the service group
    project_id: z.string(), // The ID of the project
    team_id: z.string(), // The ID of the team
  })
  .strip();

export const DeleteServiceGroupResponseBodySchema = z
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

export const DeleteUserInputBodySchema = z
  .object({
    user_id: z.string(),
  })
  .strip();

export const DeleteUserResponseBodySchema = z
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

export const TemplateInputTypeSchema = z.enum([
  'variable',
  'host',
  'volume-size',
  'database-size',
  'generated-node-port',
  'generated-password',
  'generated-node-ip',
]);

export const DeployedTemplateVolumeSchema = z
  .object({
    mountPath: z.string(),
    name: z.string(),
  })
  .strip();

export const DeployedTemplateInputSchema = z
  .object({
    current_value: z.string(),
    current_value_gb: z.number().optional(), // Numeric GB value for volume/database size inputs, consistent with PVCInfo.capacity_gb
    default: z.string().optional(),
    default_gb: z.number().optional(), // Numeric GB form of Default for volume/database size inputs
    description: z.string(),
    editable: z.boolean(),
    editable_reason: z.string().optional(),
    hidden: z.boolean(),
    id: z.string(),
    name: z.string(),
    port_protocol: ProtocolSchema.optional(),
    required: z.boolean(),
    service_id: z.string().optional(),
    target_port: z.number().optional(),
    type: TemplateInputTypeSchema,
    volume: DeployedTemplateVolumeSchema.optional(),
  })
  .strip();

export const DnsCheckSchema = z
  .object({
    dns_status: DNSStatusSchema,
    is_cloudflare: z.boolean(),
  })
  .strip();

export const DnsCheckResponseBodySchema = z
  .object({
    data: DnsCheckSchema,
  })
  .strip();

export const DockerImageSchema = z
  .object({
    pull_count: z.number(),
    repo_name: z.string(),
  })
  .strip();

export const DockerTagSchema = z
  .object({
    full_size: z.number().optional(),
    name: z.string(),
    tag_last_pushed: z.string().optional(),
  })
  .strip();

export const TlsDetailsSchema = z
  .object({
    condition: CertManagerConditionSchema,
    message: z.string(),
    reason: z.string(),
  })
  .strip();

export const TlsStatusSchema = z.enum(['pending', 'attempting', 'issued', 'not_available']);

export const IngressEndpointSchema = z
  .object({
    dns_status: DNSStatusSchema,
    environment_id: z.string(),
    host: z.string(),
    is_cloudflare: z.boolean(),
    is_ingress: z.boolean(),
    kubernetes_name: z.string(),
    path: z.string(),
    project_id: z.string(),
    service_id: z.string(),
    target_port: PortSpecSchema.optional(),
    team_id: z.string(),
    tls_issuer_messages: z.array(TlsDetailsSchema).nullable().optional(),
    tls_status: TlsStatusSchema,
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

export const GenerateWildcardDomainInputBodySchema = z
  .object({
    name: z.string(), // The base name of the wildcard domain
  })
  .strip();

export const GenerateWildcardDomainOutputBodySchema = z
  .object({
    data: z.string(), // The generated wildcard domain
  })
  .strip();

export const GeneratorTypeSchema = z.enum([
  'email',
  'password',
  'bcrypt',
  'input',
  'jwt',
  'string_replace',
  'convex_admin_key',
]);

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

export const GetGroupResponseBodySchema = z
  .object({
    data: GroupResponseSchema,
  })
  .strip();

export const InstanceHealthSchema = z.enum(['pending', 'crashing', 'active', 'terminating']);

export const SimpleInstanceStatusSchema = z
  .object({
    events: z.array(EventRecordSchema).optional(),
    kubernetes_name: z.string(),
    pod_created_at: z.string().datetime({ offset: true }).optional(),
    restart_count: z.number(),
    status: ContainerStateSchema,
  })
  .strip();

export const SimpleHealthStatusSchema = z
  .object({
    expected_instances: z.number(),
    health: InstanceHealthSchema,
    instances: z.array(SimpleInstanceStatusSchema),
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
    timestamp: z.string().datetime({ offset: true }),
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

export const GetRegistryResponseBodySchema = z
  .object({
    data: RegistryResponseSchema,
  })
  .strip();

export const GetS3SourceByIDOutputBodySchema = z
  .object({
    data: S3ResponseSchema,
  })
  .strip();

export const ServiceGroupHostInfoSchema = z
  .object({
    description: z.string().optional(),
    display_name: z.string().optional(),
    host: z.string(),
    path: z.string(),
    target_port: z.number().optional(),
    template_input_id: z.string().optional(),
  })
  .strip();

export const ServiceGroupVariableInfoSchema = z
  .object({
    description: z.string().optional(),
    display_name: z.string().optional(),
    name: z.string(),
    template_input_id: z.string().optional(),
    value: z.string(),
  })
  .strip();

export const ServiceGroupServiceInfoSchema = z
  .object({
    hosts: z.array(ServiceGroupHostInfoSchema),
    icon: z.string(),
    name: z.string(),
    service_id: z.string(),
    variables: z.array(ServiceGroupVariableInfoSchema),
    volumes: z.array(PVCInfoSchema),
  })
  .strip();

export const ServiceGroupInfoResponseSchema = z
  .object({
    service_group: ServiceGroupResponseSchema,
    services: z.array(ServiceGroupServiceInfoSchema),
    template_id: z.string().optional(),
  })
  .strip();

export const GetServiceGroupInfoResponseBodySchema = z
  .object({
    data: ServiceGroupInfoResponseSchema,
  })
  .strip();

export const GetServiceGroupResponseBodySchema = z
  .object({
    data: ServiceGroupResponseSchema,
  })
  .strip();

export const ServiceGroupTemplateInputsResponseSchema = z
  .object({
    inputs: z.array(DeployedTemplateInputSchema),
    service_group_id: z.string(),
    template_id: z.string().optional(),
    version: z.number(),
  })
  .strip();

export const GetServiceGroupTemplateInputsResponseBodySchema = z
  .object({
    data: ServiceGroupTemplateInputsResponseSchema,
  })
  .strip();

export const GetServiceResponseBodySchema = z
  .object({
    data: ServiceResponseSchema,
  })
  .strip();

export const TeamResponseSchema = z
  .object({
    created_at: z.string().datetime({ offset: true }),
    description: z.string().nullable(),
    id: z.string(),
    kubernetes_name: z.string(),
    name: z.string(),
    permissions: z.array(PermittedActionSchema), // Actions the current user can perform on this resource
  })
  .strip();

export const GetTeamResponseBodySchema = z
  .object({
    data: TeamResponseSchema,
  })
  .strip();

export const TemplateVolumeSchema = z
  .object({
    capacity_gb: z.string(),
    mountPath: z.string(),
    name: z.string(),
  })
  .strip();

export const TemplateInputSchema = z
  .object({
    collapsed: z.boolean(),
    default: z.string().optional(),
    description: z.string(),
    hidden: z.boolean(),
    id: z.string(),
    name: z.string(),
    port_protocol: ProtocolSchema.optional(),
    required: z.boolean(),
    target_port: z.number().optional(),
    type: TemplateInputTypeSchema,
    volume: TemplateVolumeSchema.optional(),
  })
  .strip();

export const TemplateVariableDisplaySchema = z
  .object({
    description: z.string().optional(),
    display_name: z.string(),
    name: z.string(),
  })
  .strip();

export const TemplateVariableReferenceSchema = z
  .object({
    additional_template_sources: z.array(z.string()).nullable(),
    is_host: z.boolean(),
    resolve_as_normal_variable: z.boolean(),
    source_id: z.string(),
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

export const ValueGeneratorSchema = z
  .object({
    add_prefix: z.string().optional(),
    base_domain: z.string().optional(),
    convex_params: ConvexAdminKeyParamsSchema.optional(),
    hash_type: ValueHashTypeSchema.optional(),
    input_id: z.string().optional(),
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

export const TemplateServiceSchema = z
  .object({
    builder: ServiceBuilderSchema,
    database_config: DatabaseConfigSchema.optional(),
    database_type: z.string().optional(),
    depends_on: z.array(z.string()),
    display_rank: z.number(),
    health_check: HealthCheckSchema.optional(),
    icon: z.string(),
    id: z.string(),
    image: z.string().optional(),
    init_containers: z.array(InitContainerSchema).nullable().optional(),
    init_db_replacers: z.record(z.string()).optional(),
    input_ids: z.array(z.string()).nullable().optional(),
    name: z.string(),
    ports: z.array(PortSpecSchema),
    protected_variables: z.array(z.string()),
    resources: ResourcesSchema.optional(),
    run_command: z.string().optional(),
    security_context: SecurityContextSchema.optional(),
    type: ServiceTypeSchema,
    variable_displays: z.array(TemplateVariableDisplaySchema).nullable().optional(),
    variable_references: z.array(TemplateVariableReferenceSchema),
    variables: z.array(TemplateVariableSchema),
    variables_mounts: z.array(VariableMountSchema),
    volumes: z.array(TemplateVolumeSchema),
  })
  .strip();

export const TemplateDefinitionSchema = z
  .object({
    description: z.string(),
    display_rank: z.number(),
    icon: z.string().optional(),
    inputs: z.array(TemplateInputSchema),
    keywords: z.array(z.string()).nullable().optional(),
    name: z.string(),
    required_capabilities: z.array(z.string()).optional(),
    resource_recommendations: TemplateResourceRecommendationsSchema.optional(),
    services: z.array(TemplateServiceSchema),
    version: z.number(),
  })
  .strip();

export const TemplateWithDefinitionResponseSchema = z
  .object({
    created_at: z.string().datetime({ offset: true }),
    definition: TemplateDefinitionSchema,
    description: z.string(),
    display_rank: z.number(),
    icon: z.string(),
    id: z.string(),
    immutable: z.boolean(),
    keywords: z.array(z.string()),
    name: z.string(),
    resource_recommendations: TemplateResourceRecommendationsSchema.optional(),
    version: z.number(),
  })
  .strip();

export const GetTemplateResponseBodySchema = z
  .object({
    data: TemplateWithDefinitionResponseSchema,
  })
  .strip();

export const PVCStatsSchema = z
  .object({
    capacity_gb: z.number().optional(),
    used_gb: z.number().optional(),
  })
  .strip();

export const VolumeMetricsResultSchema = z
  .object({
    history: z.array(MetricDetailSchema),
    pvc_name: z.string(),
    stats: PVCStatsSchema,
    step: z.number(),
  })
  .strip();

export const GetVolumeMetricsResponseBodySchema = z
  .object({
    data: VolumeMetricsResultSchema,
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
    updated_at: z.string().datetime({ offset: true }),
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
    created_at: z.string().datetime({ offset: true }).optional(),
    events: z.array(z.string()).nullable().optional(),
    github_app_id: z.number().optional(),
    id: z.number().optional(),
    permissions: GithubInstallationPermissionsSchema.optional(),
    repository_selection: z.string().optional(),
    suspended: z.boolean().optional(),
    updated_at: z.string().datetime({ offset: true }).optional(),
  })
  .strip();

export const GithubAppAPIResponseSchema = z
  .object({
    created_at: z.string().datetime({ offset: true }),
    created_by: z.string(),
    id: z.number(),
    installations: z.array(GithubInstallationAPIResponseSchema),
    name: z.string(),
    updated_at: z.string().datetime({ offset: true }),
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
    createdAt: z.string().datetime({ offset: true }),
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
    pushedAt: z.string().datetime({ offset: true }),
    size: z.number(),
    stargazersCount: z.number(),
    tags: z.array(GithubTagSchema).nullable(),
    updatedAt: z.string().datetime({ offset: true }),
    url: z.string(),
    watchersCount: z.number(),
  })
  .strip();

export const GithubRepositoryDetailResponseBodySchema = z
  .object({
    data: GithubRepositoryDetailSchema,
  })
  .strip();

export const ResourceTypeSchema = z.enum(['system', 'team', 'project', 'environment', 'service']);

export const GrantGroupPermissionInputBodySchema = z
  .object({
    action: PermittedActionSchema,
    group_id: z.string(),
    resource_id: z.string().optional(), // Specific resource to grant access to; omit when superuser is true
    resource_type: ResourceTypeSchema,
    superuser: z.boolean().optional(), // Grant access to every resource of this type
  })
  .strip();

export const ResourceSelectorSchema = z
  .object({
    id: z.string(), // Specific resource ID
    superuser: z.boolean(), // Access to every resource of this type
  })
  .strip();

export const PermissionResponseSchema = z
  .object({
    action: PermittedActionSchema,
    created_at: z.string().datetime({ offset: true }),
    id: z.string(),
    resource_selector: ResourceSelectorSchema,
    resource_type: ResourceTypeSchema,
  })
  .strip();

export const GrantGroupPermissionResponseBodySchema = z
  .object({
    data: PermissionResponseSchema,
  })
  .strip();

export const GroupMemberInputBodySchema = z
  .object({
    group_id: z.string(),
    user_id: z.string(),
  })
  .strip();

export const SuccessResponseSchema = z
  .object({
    success: z.boolean(),
  })
  .strip();

export const GroupMemberResponseBodySchema = z
  .object({
    data: SuccessResponseSchema,
  })
  .strip();

export const InstanceStatusSchema = z
  .object({
    crash_loop_reason: z.string().optional(),
    events: z.array(EventRecordSchema).optional(),
    is_crashing: z.boolean(),
    kubernetes_name: z.string(),
    last_exit_code: z.number().optional(),
    last_termination: z.string().optional(),
    pod_created_at: z.string().datetime({ offset: true }).optional(),
    ready: z.boolean(),
    restart_count: z.number(),
    state: ContainerStateSchema,
    state_message: z.string().optional(),
    state_reason: z.string().optional(),
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
    next: z.string().datetime({ offset: true }).optional(),
    previous: z.string().datetime({ offset: true }).optional(),
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

export const UserResponseSchema = z
  .object({
    created_at: z.string().datetime({ offset: true }),
    email: z.string(),
    id: z.string(),
    updated_at: z.string().datetime({ offset: true }),
  })
  .strip();

export const ListGroupMembersResponseBodySchema = z
  .object({
    data: z.array(UserResponseSchema),
  })
  .strip();

export const ListGroupPermissionsResponseBodySchema = z
  .object({
    data: z.array(PermissionResponseSchema),
  })
  .strip();

export const ListGroupsResponseBodySchema = z
  .object({
    data: z.array(GroupResponseSchema),
  })
  .strip();

export const PodPhaseSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'unknown']);

export const PodContainerStatusSchema = z
  .object({
    created_at: z.string().datetime({ offset: true }).optional(),
    environment_id: z.string(),
    has_crashing_instances: z.boolean(),
    instance_dependencies: z.array(InstanceStatusSchema),
    instances: z.array(InstanceStatusSchema),
    is_terminating: z.boolean(),
    kubernetes_name: z.string(),
    namespace: z.string(),
    phase: PodPhaseSchema,
    pod_ip: z.string().optional(),
    project_id: z.string(),
    service_id: z.string(),
    start_time: z.string().optional(),
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

export const ListRegistriesResponseBodySchema = z
  .object({
    data: z.array(RegistryResponseSchema),
  })
  .strip();

export const ListS3SourceOutputBodySchema = z
  .object({
    data: z.array(S3ResponseSchema),
  })
  .strip();

export const ListServiceGroupResponseBodySchema = z
  .object({
    data: z.array(ServiceGroupResponseSchema),
  })
  .strip();

export const ListServiceResponseBodySchema = z
  .object({
    data: z.array(ServiceResponseSchema),
  })
  .strip();

export const ListTagsResponseBodySchema = z
  .object({
    data: z.array(DockerTagSchema),
  })
  .strip();

export const ListTemplatesResponseBodySchema = z
  .object({
    data: z.array(TemplateWithDefinitionResponseSchema),
  })
  .strip();

export const ListUserGroupsResponseBodySchema = z
  .object({
    data: z.array(GroupResponseSchema),
  })
  .strip();

export const ListUsersResponseBodySchema = z
  .object({
    data: z.array(UserResponseSchema),
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
    timestamp: z.string().datetime({ offset: true }).optional(),
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

export const LoginInputBodySchema = z
  .object({
    email: z.string(),
    password: z.string(),
  })
  .strip();

export const LogoutResponseBodySchema = z
  .object({
    data: DataStructSchema,
  })
  .strip();

export const LokiDirectionSchema = z.enum(['forward', 'backward']);

export const MeResponseBodySchema = z
  .object({
    data: UserResponseSchema,
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
    disable_build_cache: z.boolean().optional(), // Disable build cache for this redeployment
    environment_id: z.string(),
    project_id: z.string(),
    service_id: z.string(),
    smart_redeploy: z.boolean().optional(), // Try to intelligently redeploy without rebuilding if possible
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

export const RegistryCacheCleanupRunSchema = z
  .object({
    finished_at: z.string().datetime({ offset: true }).nullable(),
    started_at: z.string().datetime({ offset: true }).nullable(),
    status: z.string(), // running, succeeded, or failed
  })
  .strip();

export const RegistryCacheConfigSchema = z
  .object({
    can_expand: z.boolean(), // Whether the storage class supports growing the volume
    cleanup_schedule: z.string(), // Cron schedule for the cleanup job
    cleanup_threshold_gb: z.number(), // Cache size at which cleanup begins pruning
    managed: z.boolean(), // False when an external registry is used; cache config does not apply
    maximum_storage_gb: z.number(),
    minimum_storage_gb: z.number(),
    pvc_capacity_gb: z.number(), // Provisioned size of the registry volume
    storage_class: z.string(), // Storage class backing the registry volume
    storage_step_gb: z.number(),
  })
  .strip();

export const RegistryCacheConfigResponseBodySchema = z
  .object({
    data: RegistryCacheConfigSchema,
  })
  .strip();

export const RegistryCacheSettingsSchema = z
  .object({
    cleanup_schedule: z.string(),
    cleanup_threshold_gb: z.number(),
  })
  .strip();

export const RegistryCacheStatsSchema = z
  .object({
    cleanup_threshold_gb: z.number(),
    last_cleanup: RegistryCacheCleanupRunSchema.optional(), // Most recent cleanup run, omitted if none
    managed: z.boolean(),
    pvc_capacity_gb: z.number(),
    repository_count: z.number(),
    tag_count: z.number(),
    used_bytes: z.number(),
  })
  .strip();

export const RegistryCacheStatsResponseBodySchema = z
  .object({
    data: RegistryCacheStatsSchema,
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

export const RevokeGroupPermissionInputBodySchema = z
  .object({
    group_id: z.string(),
    permission_id: z.string(),
  })
  .strip();

export const RevokeGroupPermissionResponseBodySchema = z
  .object({
    data: DeletedResponseSchema,
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

export const SearchImagesResponseBodySchema = z
  .object({
    data: z.array(DockerImageSchema),
  })
  .strip();

export const SessionUserSchema = z
  .object({
    email: z.string(),
    id: z.string(),
  })
  .strip();

export const SessionResponseBodySchema = z
  .object({
    data: SessionUserSchema,
  })
  .strip();

export const SetDefaultRegistryInputSchema = z
  .object({
    id: z.string(),
  })
  .strip();

export const SetDefaultRegistryResponseBodySchema = z
  .object({
    data: RegistryResponseSchema,
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

export const StorageMetadataSchema = z
  .object({
    maximum_storage_gb: z.number(),
    minimum_storage_gb: z.number(),
    storage_class_name: z.string(),
    storage_step_gb: z.number(),
    unable_to_detect_allocatable: z.boolean(),
  })
  .strip();

export const SystemMetaSchema = z
  .object({
    external_ipv4: z.string(),
    external_ipv6: z.string(),
    networking_capabilities: z.array(z.string()),
    networking_provider: z.string(),
    storage: StorageMetadataSchema,
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
    registry_cache_settings: RegistryCacheSettingsSchema, // Registry cache cleanup settings
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
    id: z.string(),
    value: z.string(),
  })
  .strip();

export const TemplateDeployInputSchema = z
  .object({
    environment_id: z.string(),
    group_description: z.string().optional(),
    group_name: z.string(),
    inputs: z.array(TemplateInputValueSchema).nullable().optional(),
    project_id: z.string(),
    team_id: z.string(),
    template_id: z.string(),
  })
  .strip();

export const TemplateDeployResponseBodySchema = z
  .object({
    data: z.array(ServiceResponseSchema),
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

export const UpdateGroupInputBodySchema = z
  .object({
    description: z.string(),
    group_id: z.string(),
    name: z.string(),
  })
  .strip();

export const UpdateGroupResponseBodySchema = z
  .object({
    data: GroupResponseSchema,
  })
  .strip();

export const UpdatePVCInputSchema = z
  .object({
    capacity_gb: z.number().nullable().optional(), // Size of the PVC in GB (e.g., '10')
    description: z.string().optional(),
    environment_id: z.string().optional(),
    id: z.string(),
    name: z.string().nullable().optional(),
    project_id: z.string().optional(),
    team_id: z.string(),
    type: PvcScopeSchema,
  })
  .strip();

export const UpdatePVCResponseBodySchema = z
  .object({
    data: PVCInfoSchema,
  })
  .strip();

export const UpdatePasswordInputBodySchema = z
  .object({
    current_password: z.string().optional(), // Required when changing your own password
    new_password: z.string(),
    user_id: z.string().optional(), // Defaults to the authenticated user; changing another user's password requires system admin
  })
  .strip();

export const UpdatePasswordResponseBodySchema = z
  .object({
    data: UserResponseSchema,
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

export const UpdateRegistryCacheInputSchema = z
  .object({
    cleanup_schedule: z.string().optional(),
    cleanup_threshold_gb: z.number().optional(),
    pvc_capacity_gb: z.number().optional(), // New volume size; can only grow
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

export const UpdateServiceGroupInputSchema = z
  .object({
    add_service_ids: z.array(z.string()).nullable().optional(), // The IDs of the services to add to the service group
    description: z.string().optional(), // The description of the service group
    environment_id: z.string(),
    icon: z.string().optional(), // The icon of the service group
    id: z.string(),
    name: z.string().nullable().optional(), // The name of the service group
    project_id: z.string(),
    remove_service_ids: z.array(z.string()).nullable().optional(), // The IDs of the services to remove from the service group
    team_id: z.string(),
  })
  .strip();

export const UpdateServiceGroupResponseBodySchema = z
  .object({
    data: ServiceGroupResponseSchema,
  })
  .strip();

export const UpdateServiceGroupTemplateInputsInputSchema = z
  .object({
    environment_id: z.string(), // The ID of the environment
    id: z.string(), // The ID of the service group
    inputs: z.array(TemplateInputValueSchema).nullable(), // Template input values to update
    project_id: z.string(), // The ID of the project
    team_id: z.string(), // The ID of the team
  })
  .strip();

export const UpdateServiceGroupTemplateInputsResponseBodySchema = z
  .object({
    data: ServiceGroupTemplateInputsResponseSchema,
  })
  .strip();

export const UpdateServiceInputSchema = z
  .object({
    add_ports: z.array(PortSpecSchema).nullable().optional(), // Additional ports to add, will not remove existing ports
    add_variable_mounts: z.array(VariableMountSchema).nullable().optional(), // Additional variable mounts to add, will not remove existing mounts
    add_volumes: z.array(ServiceVolumeSchema).nullable().optional(), // Additional volumes to add, will not remove existing volumes
    auto_deploy: z.boolean().optional(),
    backup_retention: z.number().optional(), // Number of base backups to retain, e.g. 3
    backup_schedule: z.string().optional(), // Cron expression for the backup schedule, e.g. '0 0 * * *'
    builder: ServiceBuilderSchema.optional(),
    database_config: DatabaseConfigSchema.optional(),
    description: z.string().nullable().optional(),
    docker_builder_build_context: z.string().optional(), // Optional path to Dockerfile context, if using docker builder - set empty string to reset to default
    docker_builder_dockerfile_path: z.string().optional(), // Optional path to Dockerfile, if using docker builder - set empty string to reset to default
    environment_id: z.string(),
    git_branch: z.string().optional(),
    git_tag: z.string().optional(), // Tag to build from, supports glob patterns
    health_check: HealthCheckSchema.optional(),
    image: z.string().optional(),
    init_containers: z.array(InitContainerSchema).nullable().optional(), // List of init containers
    is_public: z.boolean().optional(),
    name: z.string().nullable().optional(),
    overwrite_hosts: z.array(HostSpecSchema).nullable().optional(),
    overwrite_ports: z.array(PortSpecSchema).nullable().optional(),
    overwrite_variable_mounts: z.array(VariableMountSchema).nullable().optional(), // Mount variables as volumes
    overwrite_volumes: z.array(ServiceVolumeSchema).nullable().optional(), // Volumes to attach to the service
    project_id: z.string(),
    protected_variables: z.array(z.string()).optional(), // List of protected variables
    railpack_builder_build_command: z.string().optional(),
    railpack_builder_install_command: z.string().optional(),
    remove_hosts: z.array(HostSpecSchema).nullable().optional(), // Hosts to remove
    remove_ports: z.array(PortSpecSchema).nullable().optional(), // Ports to remove
    remove_variable_mounts: z.array(VariableMountSchema).nullable().optional(), // Variable mounts to remove
    remove_volumes: z.array(ServiceVolumeSchema).nullable().optional(), // Volumes to remove from the service
    replicas: z.number().optional(),
    resources: ResourcesSchema.optional(), // Resource limits and requests for the service containers
    run_command: z.string().optional(),
    s3_backup_bucket: z.string().optional(),
    s3_backup_source_id: z.string().optional(),
    service_id: z.string(),
    team_id: z.string(),
    upsert_hosts: z.array(HostSpecSchema).nullable().optional(), // Additional hosts to add, will not remove existing hosts
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

export const UserCreateInputBodySchema = z
  .object({
    email: z.string(),
    password: z.string(),
  })
  .strip();

export const UserCreateResponseBodySchema = z
  .object({
    data: UserResponseSchema,
  })
  .strip();

export const VariableReferenceResponseSchema = z
  .object({
    created_at: z.string().datetime({ offset: true }),
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
export type Capabilities = z.infer<typeof CapabilitiesSchema>;
export type CertManagerCondition = z.infer<typeof CertManagerConditionSchema>;
export type CollisionOutput = z.infer<typeof CollisionOutputSchema>;
export type CheckUniqueDomainOutputBody = z.infer<typeof CheckUniqueDomainOutputBodySchema>;
export type ContainerState = z.infer<typeof ContainerStateSchema>;
export type ConvexAdminKeyParams = z.infer<typeof ConvexAdminKeyParamsSchema>;
export type Cookie = z.infer<typeof CookieSchema>;
export type CreateBuildInputBody = z.infer<typeof CreateBuildInputBodySchema>;
export type ServiceBuilder = z.infer<typeof ServiceBuilderSchema>;
export type GitCommitter = z.infer<typeof GitCommitterSchema>;
export type EventType = z.infer<typeof EventTypeSchema>;
export type EventRecord = z.infer<typeof EventRecordSchema>;
export type DeploymentStatus = z.infer<typeof DeploymentStatusSchema>;
export type DeploymentResponse = z.infer<typeof DeploymentResponseSchema>;
export type CreateBuildOutputBody = z.infer<typeof CreateBuildOutputBodySchema>;
export type CreateEnvironmentInput = z.infer<typeof CreateEnvironmentInputSchema>;
export type PermittedAction = z.infer<typeof PermittedActionSchema>;
export type EnvironmentResponse = z.infer<typeof EnvironmentResponseSchema>;
export type CreateEnvironmentResponseBody = z.infer<typeof CreateEnvironmentResponseBodySchema>;
export type CreateGroupInputBody = z.infer<typeof CreateGroupInputBodySchema>;
export type GroupResponse = z.infer<typeof GroupResponseSchema>;
export type CreateGroupResponseBody = z.infer<typeof CreateGroupResponseBodySchema>;
export type PvcScope = z.infer<typeof PvcScopeSchema>;
export type CreatePVCInput = z.infer<typeof CreatePVCInputSchema>;
export type PersistentVolumeClaimPhase = z.infer<typeof PersistentVolumeClaimPhaseSchema>;
export type PVCInfo = z.infer<typeof PVCInfoSchema>;
export type CreatePVCResponseBody = z.infer<typeof CreatePVCResponseBodySchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type CreateProjectResponseBody = z.infer<typeof CreateProjectResponseBodySchema>;
export type CreateRegistryInput = z.infer<typeof CreateRegistryInputSchema>;
export type RegistryResponse = z.infer<typeof RegistryResponseSchema>;
export type CreateRegistryResponseBody = z.infer<typeof CreateRegistryResponseBodySchema>;
export type S3Bucket = z.infer<typeof S3BucketSchema>;
export type S3Response = z.infer<typeof S3ResponseSchema>;
export type CreateS3OutputBody = z.infer<typeof CreateS3OutputBodySchema>;
export type CreateServiceGroupInput = z.infer<typeof CreateServiceGroupInputSchema>;
export type ServiceGroupResponse = z.infer<typeof ServiceGroupResponseSchema>;
export type CreateServiceGroupResponseBody = z.infer<typeof CreateServiceGroupResponseBodySchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type HealthCheckType = z.infer<typeof HealthCheckTypeSchema>;
export type HealthCheck = z.infer<typeof HealthCheckSchema>;
export type HostSpec = z.infer<typeof HostSpecSchema>;
export type InitContainer = z.infer<typeof InitContainerSchema>;
export type Protocol = z.infer<typeof ProtocolSchema>;
export type PortSpec = z.infer<typeof PortSpecSchema>;
export type Resources = z.infer<typeof ResourcesSchema>;
export type ServiceType = z.infer<typeof ServiceTypeSchema>;
export type VariableMount = z.infer<typeof VariableMountSchema>;
export type ServiceVolume = z.infer<typeof ServiceVolumeSchema>;
export type CreateServiceInput = z.infer<typeof CreateServiceInputSchema>;
export type SecurityContext = z.infer<typeof SecurityContextSchema>;
export type ServiceConfigResponse = z.infer<typeof ServiceConfigResponseSchema>;
export type TemplateResourceRecommendations = z.infer<typeof TemplateResourceRecommendationsSchema>;
export type TemplateShortResponse = z.infer<typeof TemplateShortResponseSchema>;
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
export type DNSStatus = z.infer<typeof DNSStatusSchema>;
export type DataStruct = z.infer<typeof DataStructSchema>;
export type DatabaseConfigurable = z.infer<typeof DatabaseConfigurableSchema>;
export type DatabaseConfigurables = z.infer<typeof DatabaseConfigurablesSchema>;
export type DeleteEnvironmentInputBody = z.infer<typeof DeleteEnvironmentInputBodySchema>;
export type DeletedResponse = z.infer<typeof DeletedResponseSchema>;
export type DeleteEnvironmentResponseBody = z.infer<typeof DeleteEnvironmentResponseBodySchema>;
export type DeleteGroupInputBody = z.infer<typeof DeleteGroupInputBodySchema>;
export type DeleteGroupResponseBody = z.infer<typeof DeleteGroupResponseBodySchema>;
export type DeletePVCInput = z.infer<typeof DeletePVCInputSchema>;
export type DeletePVCResponseBody = z.infer<typeof DeletePVCResponseBodySchema>;
export type DeleteProjectInputBody = z.infer<typeof DeleteProjectInputBodySchema>;
export type DeleteProjectResponseBody = z.infer<typeof DeleteProjectResponseBodySchema>;
export type DeleteRegistryInput = z.infer<typeof DeleteRegistryInputSchema>;
export type DeleteS3SourceByIDInputBody = z.infer<typeof DeleteS3SourceByIDInputBodySchema>;
export type DeleteS3SourceByIDOutputBody = z.infer<typeof DeleteS3SourceByIDOutputBodySchema>;
export type DeleteServiceGroupInput = z.infer<typeof DeleteServiceGroupInputSchema>;
export type DeleteServiceGroupResponseBody = z.infer<typeof DeleteServiceGroupResponseBodySchema>;
export type DeleteServiceInputBody = z.infer<typeof DeleteServiceInputBodySchema>;
export type DeleteServiceResponseBody = z.infer<typeof DeleteServiceResponseBodySchema>;
export type DeleteUserInputBody = z.infer<typeof DeleteUserInputBodySchema>;
export type DeleteUserResponseBody = z.infer<typeof DeleteUserResponseBodySchema>;
export type VariableDeleteInput = z.infer<typeof VariableDeleteInputSchema>;
export type DeleteVariablesInputBody = z.infer<typeof DeleteVariablesInputBodySchema>;
export type DeleteWebhookInputBody = z.infer<typeof DeleteWebhookInputBodySchema>;
export type DeleteWebhookResponseBody = z.infer<typeof DeleteWebhookResponseBodySchema>;
export type TemplateInputType = z.infer<typeof TemplateInputTypeSchema>;
export type DeployedTemplateVolume = z.infer<typeof DeployedTemplateVolumeSchema>;
export type DeployedTemplateInput = z.infer<typeof DeployedTemplateInputSchema>;
export type DnsCheck = z.infer<typeof DnsCheckSchema>;
export type DnsCheckResponseBody = z.infer<typeof DnsCheckResponseBodySchema>;
export type DockerImage = z.infer<typeof DockerImageSchema>;
export type DockerTag = z.infer<typeof DockerTagSchema>;
export type TlsDetails = z.infer<typeof TlsDetailsSchema>;
export type TlsStatus = z.infer<typeof TlsStatusSchema>;
export type IngressEndpoint = z.infer<typeof IngressEndpointSchema>;
export type ServiceEndpoint = z.infer<typeof ServiceEndpointSchema>;
export type EndpointDiscovery = z.infer<typeof EndpointDiscoverySchema>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type ErrorModel = z.infer<typeof ErrorModelSchema>;
export type GenerateWildcardDomainInputBody = z.infer<typeof GenerateWildcardDomainInputBodySchema>;
export type GenerateWildcardDomainOutputBody = z.infer<
  typeof GenerateWildcardDomainOutputBodySchema
>;
export type GeneratorType = z.infer<typeof GeneratorTypeSchema>;
export type GetDatabaseResponseBody = z.infer<typeof GetDatabaseResponseBodySchema>;
export type GetDeploymentResponseBody = z.infer<typeof GetDeploymentResponseBodySchema>;
export type GetEnvironmentOutputBody = z.infer<typeof GetEnvironmentOutputBodySchema>;
export type GetGroupResponseBody = z.infer<typeof GetGroupResponseBodySchema>;
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
export type GetRegistryResponseBody = z.infer<typeof GetRegistryResponseBodySchema>;
export type GetS3SourceByIDOutputBody = z.infer<typeof GetS3SourceByIDOutputBodySchema>;
export type ServiceGroupHostInfo = z.infer<typeof ServiceGroupHostInfoSchema>;
export type ServiceGroupVariableInfo = z.infer<typeof ServiceGroupVariableInfoSchema>;
export type ServiceGroupServiceInfo = z.infer<typeof ServiceGroupServiceInfoSchema>;
export type ServiceGroupInfoResponse = z.infer<typeof ServiceGroupInfoResponseSchema>;
export type GetServiceGroupInfoResponseBody = z.infer<typeof GetServiceGroupInfoResponseBodySchema>;
export type GetServiceGroupResponseBody = z.infer<typeof GetServiceGroupResponseBodySchema>;
export type ServiceGroupTemplateInputsResponse = z.infer<
  typeof ServiceGroupTemplateInputsResponseSchema
>;
export type GetServiceGroupTemplateInputsResponseBody = z.infer<
  typeof GetServiceGroupTemplateInputsResponseBodySchema
>;
export type GetServiceResponseBody = z.infer<typeof GetServiceResponseBodySchema>;
export type TeamResponse = z.infer<typeof TeamResponseSchema>;
export type GetTeamResponseBody = z.infer<typeof GetTeamResponseBodySchema>;
export type TemplateVolume = z.infer<typeof TemplateVolumeSchema>;
export type TemplateInput = z.infer<typeof TemplateInputSchema>;
export type TemplateVariableDisplay = z.infer<typeof TemplateVariableDisplaySchema>;
export type TemplateVariableReference = z.infer<typeof TemplateVariableReferenceSchema>;
export type ValueHashType = z.infer<typeof ValueHashTypeSchema>;
export type JWTParams = z.infer<typeof JWTParamsSchema>;
export type ValueGenerator = z.infer<typeof ValueGeneratorSchema>;
export type TemplateVariable = z.infer<typeof TemplateVariableSchema>;
export type TemplateService = z.infer<typeof TemplateServiceSchema>;
export type TemplateDefinition = z.infer<typeof TemplateDefinitionSchema>;
export type TemplateWithDefinitionResponse = z.infer<typeof TemplateWithDefinitionResponseSchema>;
export type GetTemplateResponseBody = z.infer<typeof GetTemplateResponseBodySchema>;
export type PVCStats = z.infer<typeof PVCStatsSchema>;
export type VolumeMetricsResult = z.infer<typeof VolumeMetricsResultSchema>;
export type GetVolumeMetricsResponseBody = z.infer<typeof GetVolumeMetricsResponseBodySchema>;
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
export type ResourceType = z.infer<typeof ResourceTypeSchema>;
export type GrantGroupPermissionInputBody = z.infer<typeof GrantGroupPermissionInputBodySchema>;
export type ResourceSelector = z.infer<typeof ResourceSelectorSchema>;
export type PermissionResponse = z.infer<typeof PermissionResponseSchema>;
export type GrantGroupPermissionResponseBody = z.infer<
  typeof GrantGroupPermissionResponseBodySchema
>;
export type GroupMemberInputBody = z.infer<typeof GroupMemberInputBodySchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type GroupMemberResponseBody = z.infer<typeof GroupMemberResponseBodySchema>;
export type InstanceStatus = z.infer<typeof InstanceStatusSchema>;
export type InstanceType = z.infer<typeof InstanceTypeSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type ListDatabasesResponseBody = z.infer<typeof ListDatabasesResponseBodySchema>;
export type PaginationResponseMetadata = z.infer<typeof PaginationResponseMetadataSchema>;
export type ListDeploymentResponseData = z.infer<typeof ListDeploymentResponseDataSchema>;
export type ListDeploymentsResponseBody = z.infer<typeof ListDeploymentsResponseBodySchema>;
export type ListEndpointsResponseBody = z.infer<typeof ListEndpointsResponseBodySchema>;
export type ListEnvironmentsOutputBody = z.infer<typeof ListEnvironmentsOutputBodySchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type ListGroupMembersResponseBody = z.infer<typeof ListGroupMembersResponseBodySchema>;
export type ListGroupPermissionsResponseBody = z.infer<
  typeof ListGroupPermissionsResponseBodySchema
>;
export type ListGroupsResponseBody = z.infer<typeof ListGroupsResponseBodySchema>;
export type PodPhase = z.infer<typeof PodPhaseSchema>;
export type PodContainerStatus = z.infer<typeof PodContainerStatusSchema>;
export type ListInstancesResponseBody = z.infer<typeof ListInstancesResponseBodySchema>;
export type ListPVCResponseBody = z.infer<typeof ListPVCResponseBodySchema>;
export type ListProjectResponseBody = z.infer<typeof ListProjectResponseBodySchema>;
export type ListRegistriesResponseBody = z.infer<typeof ListRegistriesResponseBodySchema>;
export type ListS3SourceOutputBody = z.infer<typeof ListS3SourceOutputBodySchema>;
export type ListServiceGroupResponseBody = z.infer<typeof ListServiceGroupResponseBodySchema>;
export type ListServiceResponseBody = z.infer<typeof ListServiceResponseBodySchema>;
export type ListTagsResponseBody = z.infer<typeof ListTagsResponseBodySchema>;
export type ListTemplatesResponseBody = z.infer<typeof ListTemplatesResponseBodySchema>;
export type ListUserGroupsResponseBody = z.infer<typeof ListUserGroupsResponseBodySchema>;
export type ListUsersResponseBody = z.infer<typeof ListUsersResponseBodySchema>;
export type ListWebhooksResponseBody = z.infer<typeof ListWebhooksResponseBodySchema>;
export type LogMetadata = z.infer<typeof LogMetadataSchema>;
export type LogEvent = z.infer<typeof LogEventSchema>;
export type LogEventsMessageType = z.infer<typeof LogEventsMessageTypeSchema>;
export type LogEvents = z.infer<typeof LogEventsSchema>;
export type LogType = z.infer<typeof LogTypeSchema>;
export type LoginInputBody = z.infer<typeof LoginInputBodySchema>;
export type LogoutResponseBody = z.infer<typeof LogoutResponseBodySchema>;
export type LokiDirection = z.infer<typeof LokiDirectionSchema>;
export type MeResponseBody = z.infer<typeof MeResponseBodySchema>;
export type QueryLogsResponseBody = z.infer<typeof QueryLogsResponseBodySchema>;
export type RedeployInputBody = z.infer<typeof RedeployInputBodySchema>;
export type RedeployOutputBody = z.infer<typeof RedeployOutputBodySchema>;
export type ReferenceableVariablesResponseBody = z.infer<
  typeof ReferenceableVariablesResponseBodySchema
>;
export type RegistryCacheCleanupRun = z.infer<typeof RegistryCacheCleanupRunSchema>;
export type RegistryCacheConfig = z.infer<typeof RegistryCacheConfigSchema>;
export type RegistryCacheConfigResponseBody = z.infer<typeof RegistryCacheConfigResponseBodySchema>;
export type RegistryCacheSettings = z.infer<typeof RegistryCacheSettingsSchema>;
export type RegistryCacheStats = z.infer<typeof RegistryCacheStatsSchema>;
export type RegistryCacheStatsResponseBody = z.infer<typeof RegistryCacheStatsResponseBodySchema>;
export type ResolveAvailableVariableReferenceResponseBody = z.infer<
  typeof ResolveAvailableVariableReferenceResponseBodySchema
>;
export type ResolveVariableReferenceResponseBody = z.infer<
  typeof ResolveVariableReferenceResponseBodySchema
>;
export type RestartInstancesInputBody = z.infer<typeof RestartInstancesInputBodySchema>;
export type Restarted = z.infer<typeof RestartedSchema>;
export type RestartServicesResponseBody = z.infer<typeof RestartServicesResponseBodySchema>;
export type RevokeGroupPermissionInputBody = z.infer<typeof RevokeGroupPermissionInputBodySchema>;
export type RevokeGroupPermissionResponseBody = z.infer<
  typeof RevokeGroupPermissionResponseBodySchema
>;
export type S3BackendCreateInput = z.infer<typeof S3BackendCreateInputSchema>;
export type S3TestResult = z.infer<typeof S3TestResultSchema>;
export type SearchImagesResponseBody = z.infer<typeof SearchImagesResponseBodySchema>;
export type SessionUser = z.infer<typeof SessionUserSchema>;
export type SessionResponseBody = z.infer<typeof SessionResponseBodySchema>;
export type SetDefaultRegistryInput = z.infer<typeof SetDefaultRegistryInputSchema>;
export type SetDefaultRegistryResponseBody = z.infer<typeof SetDefaultRegistryResponseBodySchema>;
export type SystemSettingsResponse = z.infer<typeof SystemSettingsResponseSchema>;
export type SettingsResponseBody = z.infer<typeof SettingsResponseBodySchema>;
export type SetupData = z.infer<typeof SetupDataSchema>;
export type SetupStatusResponseBody = z.infer<typeof SetupStatusResponseBodySchema>;
export type SortByField = z.infer<typeof SortByFieldSchema>;
export type SortOrder = z.infer<typeof SortOrderSchema>;
export type StorageMetadata = z.infer<typeof StorageMetadataSchema>;
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
export type UpdateGroupInputBody = z.infer<typeof UpdateGroupInputBodySchema>;
export type UpdateGroupResponseBody = z.infer<typeof UpdateGroupResponseBodySchema>;
export type UpdatePVCInput = z.infer<typeof UpdatePVCInputSchema>;
export type UpdatePVCResponseBody = z.infer<typeof UpdatePVCResponseBodySchema>;
export type UpdatePasswordInputBody = z.infer<typeof UpdatePasswordInputBodySchema>;
export type UpdatePasswordResponseBody = z.infer<typeof UpdatePasswordResponseBodySchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;
export type UpdateProjectResponseBody = z.infer<typeof UpdateProjectResponseBodySchema>;
export type UpdateRegistryCacheInput = z.infer<typeof UpdateRegistryCacheInputSchema>;
export type UpdateS3SourceInputBody = z.infer<typeof UpdateS3SourceInputBodySchema>;
export type UpdateS3SourceResponseBody = z.infer<typeof UpdateS3SourceResponseBodySchema>;
export type UpdateServiceGroupInput = z.infer<typeof UpdateServiceGroupInputSchema>;
export type UpdateServiceGroupResponseBody = z.infer<typeof UpdateServiceGroupResponseBodySchema>;
export type UpdateServiceGroupTemplateInputsInput = z.infer<
  typeof UpdateServiceGroupTemplateInputsInputSchema
>;
export type UpdateServiceGroupTemplateInputsResponseBody = z.infer<
  typeof UpdateServiceGroupTemplateInputsResponseBodySchema
>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceInputSchema>;
export type UpdateStatusResponseBody = z.infer<typeof UpdateStatusResponseBodySchema>;
export type UpdateTeamInputBody = z.infer<typeof UpdateTeamInputBodySchema>;
export type UpdateTeamResponseBody = z.infer<typeof UpdateTeamResponseBodySchema>;
export type UpdateWebhookResponseBody = z.infer<typeof UpdateWebhookResponseBodySchema>;
export type VariableUpdateBehavior = z.infer<typeof VariableUpdateBehaviorSchema>;
export type VariableReferenceSource = z.infer<typeof VariableReferenceSourceSchema>;
export type VariableReferenceInputItem = z.infer<typeof VariableReferenceInputItemSchema>;
export type UpsertVariablesInputBody = z.infer<typeof UpsertVariablesInputBodySchema>;
export type UserCreateInputBody = z.infer<typeof UserCreateInputBodySchema>;
export type UserCreateResponseBody = z.infer<typeof UserCreateResponseBodySchema>;
export type VariableReferenceResponse = z.infer<typeof VariableReferenceResponseSchema>;
export type VariableResponseItem = z.infer<typeof VariableResponseItemSchema>;
export type VariableResponse = z.infer<typeof VariableResponseSchema>;
export type VariablesResponseBody = z.infer<typeof VariablesResponseBodySchema>;
export type WebhookCreateInput = z.infer<typeof WebhookCreateInputSchema>;
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
export type WebhookUpdateInput = z.infer<typeof WebhookUpdateInputSchema>;

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
    cursor: z.string().datetime({ offset: true }).optional(),
    per_page: z.number(),
    team_id: z.string(), // The ID of the team
    project_id: z.string(), // The ID of the project
    environment_id: z.string(), // The ID of the environment
    service_id: z.string(), // The ID of the service
    statuses: z.array(DeploymentStatusSchema).nullable().optional(), // Filter by status
  })
  .passthrough();

export const search_docker_imagesQuerySchema = z
  .object({
    query: z.string().optional(),
  })
  .passthrough();

export const list_docker_tagsQuerySchema = z
  .object({
    repository: z.string(),
    search: z.string().optional(),
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

export const get_groupQuerySchema = z
  .object({
    group_id: z.string(),
  })
  .passthrough();

export const list_group_membersQuerySchema = z
  .object({
    group_id: z.string(),
  })
  .passthrough();

export const list_group_permissionsQuerySchema = z
  .object({
    group_id: z.string(),
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
    start: z.string().datetime({ offset: true }).optional(), // Start time for the query
    end: z.string().datetime({ offset: true }).optional(), // End time for the query
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
    start: z.string().datetime({ offset: true }).optional(),
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
    start: z.string().datetime({ offset: true }).optional(), // Start time for the query, defaults to 1 week ago
    end: z.string().datetime({ offset: true }).optional(), // End time for the query, defaults to now
  })
  .passthrough();

export const get_system_metricsQuerySchema = z
  .object({
    node_name: z.string().optional(),
    zone: z.string().optional(),
    region: z.string().optional(),
    cluster_name: z.string().optional(),
    start: z.string().datetime({ offset: true }).optional(), // Start time for the query, defaults to 24 hours ago
    end: z.string().datetime({ offset: true }).optional(), // End time for the query, defaults to now
  })
  .passthrough();

export const get_volume_metricsQuerySchema = z
  .object({
    team_id: z.string(),
    pvc_id: z.string(),
    start: z.string().datetime({ offset: true }).optional(), // Start time for the query, defaults to 1 week ago
    end: z.string().datetime({ offset: true }).optional(), // End time for the query, defaults to now
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

export const get_service_groupQuerySchema = z
  .object({
    id: z.string(), // The ID of the service group
    team_id: z.string(), // The ID of the team
    project_id: z.string(), // The ID of the project
    environment_id: z.string(), // The ID of the environment
  })
  .passthrough();

export const get_service_group_infoQuerySchema = z
  .object({
    id: z.string(), // The ID of the service group
    team_id: z.string(), // The ID of the team
    project_id: z.string(), // The ID of the project
    environment_id: z.string(), // The ID of the environment
  })
  .passthrough();

export const list_service_groupsQuerySchema = z
  .object({
    team_id: z.string(), // The ID of the team
    project_id: z.string(), // The ID of the project
    environment_id: z.string(), // The ID of the environment
  })
  .passthrough();

export const get_service_group_template_inputsQuerySchema = z
  .object({
    id: z.string(), // The ID of the service group
    team_id: z.string(), // The ID of the team
    project_id: z.string(), // The ID of the project
    environment_id: z.string(), // The ID of the environment
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

export const get_registryQuerySchema = z
  .object({
    id: z.string(),
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

export const exec_terminalQuerySchema = z
  .object({
    team_id: z.string(),
    project_id: z.string(),
    environment_id: z.string(),
    service_id: z.string(),
    pod_name: z.string().optional(),
    container: z.string().optional(),
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

export const list_user_groupsQuerySchema = z
  .object({
    user_id: z.string().optional(), // Defaults to the authenticated user when omitted
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

export const AvailableDatabaseEnum = z.enum([
  'postgres',
  'redis',
  'mysql',
  'mongodb',
  'clickhouse',
]);
export type TAvailableDatabase = z.infer<typeof AvailableDatabaseEnum>;

export type ClientOptions = {
  apiUrl: string;
  fetchFn?: typeof fetch;
};

export function createClient({ apiUrl, fetchFn = fetch }: ClientOptions) {
  return {
    auth: {
      login: async (
        params: LoginInputBody,
        fetchOptions?: RequestInit,
      ): Promise<SessionResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/auth/login`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = LoginInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = SessionResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      logout: async (
        params?: undefined,
        fetchOptions?: RequestInit,
      ): Promise<LogoutResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/auth/logout`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = LogoutResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/deployments/create`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = CreateBuildInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = CreateBuildOutputBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/deployments/get`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GetDeploymentResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/deployments/list`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = ListDeploymentsResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/deployments/redeploy`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = RedeployInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = RedeployOutputBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    docker: {
      search: async (
        params: z.infer<typeof search_docker_imagesQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<SearchImagesResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/docker/search`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
          const validatedQuery = search_docker_imagesQuerySchema.parse(params);
          const queryKeys = ['query'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = SearchImagesResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      tags: async (
        params: z.infer<typeof list_docker_tagsQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<ListTagsResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/docker/tags`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
          const validatedQuery = list_docker_tagsQuerySchema.parse(params);
          const queryKeys = ['repository', 'search'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = ListTagsResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/environments/create`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = CreateEnvironmentInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = CreateEnvironmentResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/environments/delete`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = DeleteEnvironmentInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = DeleteEnvironmentResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/environments/get`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GetEnvironmentOutputBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/environments/list`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = ListEnvironmentsOutputBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/environments/update`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = UpdateEnvironmentInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = UpdateEnvironmentResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
            const url = new URL(
              `${apiUrl}/github/app/create`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );
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
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = GithubAppCreateResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
            const url = new URL(
              `${apiUrl}/github/app/get`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );
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
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = GithubAppGetResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
          const url = new URL(
            `${apiUrl}/github/apps`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GithubAppListResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
              const url = new URL(
                `${apiUrl}/github/installation/${installationId}/organizations`,
                typeof window !== 'undefined' ? window.location.origin : undefined,
              );

              const options: RequestInit = {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                ...fetchOptions,
              };

              const response = await fetchFn(url.toString(), options);
              if (!response.ok) {
                console.log(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
                const data = await response.json();
                console.log(`GO API request error`, data);
                console.log(`Request URL is:`, url.toString());

                let errorMessage =
                  '`GO API request failed with status ${response.status}: ${response.statusText}`';
                if (
                  data &&
                  Array.isArray(data.details) &&
                  data.details.length > 0 &&
                  typeof data.details[0] === 'string'
                ) {
                  errorMessage = data.details[0];
                }
                throw new Error(errorMessage);
              }
              const data = await response.json();
              const { data: parsedData, error } =
                GithubAdminOrganizationListResponseBodySchema.safeParse(data);
              if (error) {
                console.error('Response validation error:', error);
                console.error('Response data:', data);
                throw new Error(error.message);
              }
              return parsedData;
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
          const url = new URL(
            `${apiUrl}/github/installations`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } =
            GithubAppInstallationListResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
            const url = new URL(
              `${apiUrl}/github/repositories`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } =
              GithubAdminRepositoryListResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
              const url = new URL(
                `${apiUrl}/github/repositories/info`,
                typeof window !== 'undefined' ? window.location.origin : undefined,
              );
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
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                ...fetchOptions,
              };

              const response = await fetchFn(url.toString(), options);
              if (!response.ok) {
                console.log(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
                const data = await response.json();
                console.log(`GO API request error`, data);
                console.log(`Request URL is:`, url.toString());

                let errorMessage =
                  '`GO API request failed with status ${response.status}: ${response.statusText}`';
                if (
                  data &&
                  Array.isArray(data.details) &&
                  data.details.length > 0 &&
                  typeof data.details[0] === 'string'
                ) {
                  errorMessage = data.details[0];
                }
                throw new Error(errorMessage);
              }
              const data = await response.json();
              const { data: parsedData, error } =
                GithubRepositoryDetailResponseBodySchema.safeParse(data);
              if (error) {
                console.error('Response validation error:', error);
                console.error('Response data:', data);
                throw new Error(error.message);
              }
              return parsedData;
            } catch (error) {
              console.error('Error in API request:', error);
              throw error;
            }
          },
        },
      ),
    },
    groups: {
      create: async (
        params: CreateGroupInputBody,
        fetchOptions?: RequestInit,
      ): Promise<CreateGroupResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/groups/create`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = CreateGroupInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = CreateGroupResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      delete: async (
        params: DeleteGroupInputBody,
        fetchOptions?: RequestInit,
      ): Promise<DeleteGroupResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/groups/delete`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = DeleteGroupInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = DeleteGroupResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      get: async (
        params: z.infer<typeof get_groupQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetGroupResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/groups/get`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
          const validatedQuery = get_groupQuerySchema.parse(params);
          const queryKeys = ['group_id'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GetGroupResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      list: async (
        params?: undefined,
        fetchOptions?: RequestInit,
      ): Promise<ListGroupsResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/groups/list`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = ListGroupsResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      members: Object.assign(
        async (
          params: z.infer<typeof list_group_membersQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<ListGroupMembersResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(
              `${apiUrl}/groups/members`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );
            const validatedQuery = list_group_membersQuerySchema.parse(params);
            const queryKeys = ['group_id'];
            queryKeys.forEach((key) => {
              const value = validatedQuery[key as keyof typeof validatedQuery];
              if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
              }
            });
            const options: RequestInit = {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = ListGroupMembersResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        {
          add: async (
            params: GroupMemberInputBody,
            fetchOptions?: RequestInit,
          ): Promise<GroupMemberResponseBody> => {
            try {
              if (!apiUrl || typeof apiUrl !== 'string') {
                throw new Error('API URL is undefined or not a string');
              }
              const url = new URL(
                `${apiUrl}/groups/members/add`,
                typeof window !== 'undefined' ? window.location.origin : undefined,
              );

              const options: RequestInit = {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                ...fetchOptions,
              };
              const validatedBody = GroupMemberInputBodySchema.parse(params);
              options.body = JSON.stringify(validatedBody);
              const response = await fetchFn(url.toString(), options);
              if (!response.ok) {
                console.log(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
                const data = await response.json();
                console.log(`GO API request error`, data);
                console.log(`Request URL is:`, url.toString());
                console.log(`Request body is:`, validatedBody);
                let errorMessage =
                  '`GO API request failed with status ${response.status}: ${response.statusText}`';
                if (
                  data &&
                  Array.isArray(data.details) &&
                  data.details.length > 0 &&
                  typeof data.details[0] === 'string'
                ) {
                  errorMessage = data.details[0];
                }
                throw new Error(errorMessage);
              }
              const data = await response.json();
              const { data: parsedData, error } = GroupMemberResponseBodySchema.safeParse(data);
              if (error) {
                console.error('Response validation error:', error);
                console.error('Response data:', data);
                throw new Error(error.message);
              }
              return parsedData;
            } catch (error) {
              console.error('Error in API request:', error);
              throw error;
            }
          },
          remove: async (
            params: GroupMemberInputBody,
            fetchOptions?: RequestInit,
          ): Promise<GroupMemberResponseBody> => {
            try {
              if (!apiUrl || typeof apiUrl !== 'string') {
                throw new Error('API URL is undefined or not a string');
              }
              const url = new URL(
                `${apiUrl}/groups/members/remove`,
                typeof window !== 'undefined' ? window.location.origin : undefined,
              );

              const options: RequestInit = {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                ...fetchOptions,
              };
              const validatedBody = GroupMemberInputBodySchema.parse(params);
              options.body = JSON.stringify(validatedBody);
              const response = await fetchFn(url.toString(), options);
              if (!response.ok) {
                console.log(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
                const data = await response.json();
                console.log(`GO API request error`, data);
                console.log(`Request URL is:`, url.toString());
                console.log(`Request body is:`, validatedBody);
                let errorMessage =
                  '`GO API request failed with status ${response.status}: ${response.statusText}`';
                if (
                  data &&
                  Array.isArray(data.details) &&
                  data.details.length > 0 &&
                  typeof data.details[0] === 'string'
                ) {
                  errorMessage = data.details[0];
                }
                throw new Error(errorMessage);
              }
              const data = await response.json();
              const { data: parsedData, error } = GroupMemberResponseBodySchema.safeParse(data);
              if (error) {
                console.error('Response validation error:', error);
                console.error('Response data:', data);
                throw new Error(error.message);
              }
              return parsedData;
            } catch (error) {
              console.error('Error in API request:', error);
              throw error;
            }
          },
        },
      ),
      permissions: Object.assign(
        async (
          params: z.infer<typeof list_group_permissionsQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<ListGroupPermissionsResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(
              `${apiUrl}/groups/permissions`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );
            const validatedQuery = list_group_permissionsQuerySchema.parse(params);
            const queryKeys = ['group_id'];
            queryKeys.forEach((key) => {
              const value = validatedQuery[key as keyof typeof validatedQuery];
              if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
              }
            });
            const options: RequestInit = {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } =
              ListGroupPermissionsResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        {
          grant: async (
            params: GrantGroupPermissionInputBody,
            fetchOptions?: RequestInit,
          ): Promise<GrantGroupPermissionResponseBody> => {
            try {
              if (!apiUrl || typeof apiUrl !== 'string') {
                throw new Error('API URL is undefined or not a string');
              }
              const url = new URL(
                `${apiUrl}/groups/permissions/grant`,
                typeof window !== 'undefined' ? window.location.origin : undefined,
              );

              const options: RequestInit = {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                ...fetchOptions,
              };
              const validatedBody = GrantGroupPermissionInputBodySchema.parse(params);
              options.body = JSON.stringify(validatedBody);
              const response = await fetchFn(url.toString(), options);
              if (!response.ok) {
                console.log(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
                const data = await response.json();
                console.log(`GO API request error`, data);
                console.log(`Request URL is:`, url.toString());
                console.log(`Request body is:`, validatedBody);
                let errorMessage =
                  '`GO API request failed with status ${response.status}: ${response.statusText}`';
                if (
                  data &&
                  Array.isArray(data.details) &&
                  data.details.length > 0 &&
                  typeof data.details[0] === 'string'
                ) {
                  errorMessage = data.details[0];
                }
                throw new Error(errorMessage);
              }
              const data = await response.json();
              const { data: parsedData, error } =
                GrantGroupPermissionResponseBodySchema.safeParse(data);
              if (error) {
                console.error('Response validation error:', error);
                console.error('Response data:', data);
                throw new Error(error.message);
              }
              return parsedData;
            } catch (error) {
              console.error('Error in API request:', error);
              throw error;
            }
          },
          revoke: async (
            params: RevokeGroupPermissionInputBody,
            fetchOptions?: RequestInit,
          ): Promise<RevokeGroupPermissionResponseBody> => {
            try {
              if (!apiUrl || typeof apiUrl !== 'string') {
                throw new Error('API URL is undefined or not a string');
              }
              const url = new URL(
                `${apiUrl}/groups/permissions/revoke`,
                typeof window !== 'undefined' ? window.location.origin : undefined,
              );

              const options: RequestInit = {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                ...fetchOptions,
              };
              const validatedBody = RevokeGroupPermissionInputBodySchema.parse(params);
              options.body = JSON.stringify(validatedBody);
              const response = await fetchFn(url.toString(), options);
              if (!response.ok) {
                console.log(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
                const data = await response.json();
                console.log(`GO API request error`, data);
                console.log(`Request URL is:`, url.toString());
                console.log(`Request body is:`, validatedBody);
                let errorMessage =
                  '`GO API request failed with status ${response.status}: ${response.statusText}`';
                if (
                  data &&
                  Array.isArray(data.details) &&
                  data.details.length > 0 &&
                  typeof data.details[0] === 'string'
                ) {
                  errorMessage = data.details[0];
                }
                throw new Error(errorMessage);
              }
              const data = await response.json();
              const { data: parsedData, error } =
                RevokeGroupPermissionResponseBodySchema.safeParse(data);
              if (error) {
                console.error('Response validation error:', error);
                console.error('Response data:', data);
                throw new Error(error.message);
              }
              return parsedData;
            } catch (error) {
              console.error('Error in API request:', error);
              throw error;
            }
          },
        },
      ),
      update: async (
        params: UpdateGroupInputBody,
        fetchOptions?: RequestInit,
      ): Promise<UpdateGroupResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/groups/update`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = UpdateGroupInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = UpdateGroupResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
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
          const url = new URL(
            `${apiUrl}/instances/health`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GetInstanceHealthResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/instances/list`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = ListInstancesResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/instances/restart`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = RestartInstancesInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = RestartServicesResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/logs/query`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = QueryLogsResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/logs/stream`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
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
          const url = new URL(
            `${apiUrl}/metrics/get`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GetMetricsResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      getSystem: async (
        params: z.infer<typeof get_system_metricsQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetNodeMetricsResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/metrics/get-system`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
          const validatedQuery = get_system_metricsQuerySchema.parse(params);
          const queryKeys = ['node_name', 'zone', 'region', 'cluster_name', 'start', 'end'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GetNodeMetricsResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      getVolume: async (
        params: z.infer<typeof get_volume_metricsQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetVolumeMetricsResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/metrics/get-volume`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
          const validatedQuery = get_volume_metricsQuerySchema.parse(params);
          const queryKeys = ['team_id', 'pvc_id', 'start', 'end'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GetVolumeMetricsResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/projects/create`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = CreateProjectInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = CreateProjectResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/projects/delete`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = DeleteProjectInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = DeleteProjectResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/projects/get`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GetProjectResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/projects/list`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = ListProjectResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/projects/update`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = UpdateProjectInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = UpdateProjectResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    service_groups: {
      create: async (
        params: CreateServiceGroupInput,
        fetchOptions?: RequestInit,
      ): Promise<CreateServiceGroupResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/service_groups/create`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = CreateServiceGroupInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = CreateServiceGroupResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      delete: async (
        params: DeleteServiceGroupInput,
        fetchOptions?: RequestInit,
      ): Promise<DeleteServiceGroupResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/service_groups/delete`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = DeleteServiceGroupInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = DeleteServiceGroupResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      get: async (
        params: z.infer<typeof get_service_groupQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetServiceGroupResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/service_groups/get`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
          const validatedQuery = get_service_groupQuerySchema.parse(params);
          const queryKeys = ['id', 'team_id', 'project_id', 'environment_id'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GetServiceGroupResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      info: async (
        params: z.infer<typeof get_service_group_infoQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<GetServiceGroupInfoResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/service_groups/info`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
          const validatedQuery = get_service_group_infoQuerySchema.parse(params);
          const queryKeys = ['id', 'team_id', 'project_id', 'environment_id'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GetServiceGroupInfoResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      list: async (
        params: z.infer<typeof list_service_groupsQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<ListServiceGroupResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/service_groups/list`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
          const validatedQuery = list_service_groupsQuerySchema.parse(params);
          const queryKeys = ['team_id', 'project_id', 'environment_id'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = ListServiceGroupResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      templateInputs: async (
        params: UpdateServiceGroupTemplateInputsInput,
        fetchOptions?: RequestInit,
      ): Promise<UpdateServiceGroupTemplateInputsResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/service_groups/template-inputs`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = UpdateServiceGroupTemplateInputsInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } =
            UpdateServiceGroupTemplateInputsResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      update: async (
        params: UpdateServiceGroupInput,
        fetchOptions?: RequestInit,
      ): Promise<UpdateServiceGroupResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/service_groups/update`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = UpdateServiceGroupInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = UpdateServiceGroupResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/services/create`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = CreateServiceInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = CreateServiceResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
              const url = new URL(
                `${apiUrl}/services/databases/installable/get`,
                typeof window !== 'undefined' ? window.location.origin : undefined,
              );
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
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                ...fetchOptions,
              };

              const response = await fetchFn(url.toString(), options);
              if (!response.ok) {
                console.log(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
                const data = await response.json();
                console.log(`GO API request error`, data);
                console.log(`Request URL is:`, url.toString());

                let errorMessage =
                  '`GO API request failed with status ${response.status}: ${response.statusText}`';
                if (
                  data &&
                  Array.isArray(data.details) &&
                  data.details.length > 0 &&
                  typeof data.details[0] === 'string'
                ) {
                  errorMessage = data.details[0];
                }
                throw new Error(errorMessage);
              }
              const data = await response.json();
              const { data: parsedData, error } = GetDatabaseResponseBodySchema.safeParse(data);
              if (error) {
                console.error('Response validation error:', error);
                console.error('Response data:', data);
                throw new Error(error.message);
              }
              return parsedData;
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
              const url = new URL(
                `${apiUrl}/services/databases/installable/list`,
                typeof window !== 'undefined' ? window.location.origin : undefined,
              );

              const options: RequestInit = {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                ...fetchOptions,
              };

              const response = await fetchFn(url.toString(), options);
              if (!response.ok) {
                console.log(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
                const data = await response.json();
                console.log(`GO API request error`, data);
                console.log(`Request URL is:`, url.toString());

                let errorMessage =
                  '`GO API request failed with status ${response.status}: ${response.statusText}`';
                if (
                  data &&
                  Array.isArray(data.details) &&
                  data.details.length > 0 &&
                  typeof data.details[0] === 'string'
                ) {
                  errorMessage = data.details[0];
                }
                throw new Error(errorMessage);
              }
              const data = await response.json();
              const { data: parsedData, error } = ListDatabasesResponseBodySchema.safeParse(data);
              if (error) {
                console.error('Response validation error:', error);
                console.error('Response data:', data);
                throw new Error(error.message);
              }
              return parsedData;
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
          const url = new URL(
            `${apiUrl}/services/delete`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = DeleteServiceInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = DeleteServiceResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
            const url = new URL(
              `${apiUrl}/services/endpoints/list`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );
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
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = ListEndpointsResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
          const url = new URL(
            `${apiUrl}/services/get`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GetServiceResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/services/list`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = ListServiceResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/services/update`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = UpdateServiceInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = UpdatServiceResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/setup/create-user`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = CreateUserInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = CreateUserResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/setup/status`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = SetupStatusResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
            const url = new URL(
              `${apiUrl}/storage/pvc/create`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };
            const validatedBody = CreatePVCInputSchema.parse(params);
            options.body = JSON.stringify(validatedBody);
            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());
              console.log(`Request body is:`, validatedBody);
              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = CreatePVCResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
            const url = new URL(
              `${apiUrl}/storage/pvc/delete`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'DELETE',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };
            const validatedBody = DeletePVCInputSchema.parse(params);
            options.body = JSON.stringify(validatedBody);
            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());
              console.log(`Request body is:`, validatedBody);
              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = DeletePVCResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
            const url = new URL(
              `${apiUrl}/storage/pvc/get`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );
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
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = GetPVCResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
            const url = new URL(
              `${apiUrl}/storage/pvc/list`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );
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
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = ListPVCResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
            const url = new URL(
              `${apiUrl}/storage/pvc/update`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'PUT',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };
            const validatedBody = UpdatePVCInputSchema.parse(params);
            options.body = JSON.stringify(validatedBody);
            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());
              console.log(`Request body is:`, validatedBody);
              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = UpdatePVCResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
            const url = new URL(
              `${apiUrl}/storage/s3/create`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };
            const validatedBody = S3BackendCreateInputSchema.parse(params);
            options.body = JSON.stringify(validatedBody);
            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());
              console.log(`Request body is:`, validatedBody);
              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = CreateS3OutputBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
            const url = new URL(
              `${apiUrl}/storage/s3/delete`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'DELETE',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };
            const validatedBody = DeleteS3SourceByIDInputBodySchema.parse(params);
            options.body = JSON.stringify(validatedBody);
            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());
              console.log(`Request body is:`, validatedBody);
              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = DeleteS3SourceByIDOutputBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
            const url = new URL(
              `${apiUrl}/storage/s3/get`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );
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
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = GetS3SourceByIDOutputBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
            const url = new URL(
              `${apiUrl}/storage/s3/list`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );
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
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = ListS3SourceOutputBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
            const url = new URL(
              `${apiUrl}/storage/s3/test`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };
            const validatedBody = TestS3AccessInputBodySchema.parse(params);
            options.body = JSON.stringify(validatedBody);
            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());
              console.log(`Request body is:`, validatedBody);
              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = TestS3OutputBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
            const url = new URL(
              `${apiUrl}/storage/s3/update`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };
            const validatedBody = UpdateS3SourceInputBodySchema.parse(params);
            options.body = JSON.stringify(validatedBody);
            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());
              console.log(`Request body is:`, validatedBody);
              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = UpdateS3SourceResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
      },
    },
    system: {
      cache: {
        registry: {
          config: async (
            params?: undefined,
            fetchOptions?: RequestInit,
          ): Promise<RegistryCacheConfigResponseBody> => {
            try {
              if (!apiUrl || typeof apiUrl !== 'string') {
                throw new Error('API URL is undefined or not a string');
              }
              const url = new URL(
                `${apiUrl}/system/cache/registry/config`,
                typeof window !== 'undefined' ? window.location.origin : undefined,
              );

              const options: RequestInit = {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                ...fetchOptions,
              };

              const response = await fetchFn(url.toString(), options);
              if (!response.ok) {
                console.log(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
                const data = await response.json();
                console.log(`GO API request error`, data);
                console.log(`Request URL is:`, url.toString());

                let errorMessage =
                  '`GO API request failed with status ${response.status}: ${response.statusText}`';
                if (
                  data &&
                  Array.isArray(data.details) &&
                  data.details.length > 0 &&
                  typeof data.details[0] === 'string'
                ) {
                  errorMessage = data.details[0];
                }
                throw new Error(errorMessage);
              }
              const data = await response.json();
              const { data: parsedData, error } =
                RegistryCacheConfigResponseBodySchema.safeParse(data);
              if (error) {
                console.error('Response validation error:', error);
                console.error('Response data:', data);
                throw new Error(error.message);
              }
              return parsedData;
            } catch (error) {
              console.error('Error in API request:', error);
              throw error;
            }
          },
          stats: async (
            params?: undefined,
            fetchOptions?: RequestInit,
          ): Promise<RegistryCacheStatsResponseBody> => {
            try {
              if (!apiUrl || typeof apiUrl !== 'string') {
                throw new Error('API URL is undefined or not a string');
              }
              const url = new URL(
                `${apiUrl}/system/cache/registry/stats`,
                typeof window !== 'undefined' ? window.location.origin : undefined,
              );

              const options: RequestInit = {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                ...fetchOptions,
              };

              const response = await fetchFn(url.toString(), options);
              if (!response.ok) {
                console.log(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
                const data = await response.json();
                console.log(`GO API request error`, data);
                console.log(`Request URL is:`, url.toString());

                let errorMessage =
                  '`GO API request failed with status ${response.status}: ${response.statusText}`';
                if (
                  data &&
                  Array.isArray(data.details) &&
                  data.details.length > 0 &&
                  typeof data.details[0] === 'string'
                ) {
                  errorMessage = data.details[0];
                }
                throw new Error(errorMessage);
              }
              const data = await response.json();
              const { data: parsedData, error } =
                RegistryCacheStatsResponseBodySchema.safeParse(data);
              if (error) {
                console.error('Response validation error:', error);
                console.error('Response data:', data);
                throw new Error(error.message);
              }
              return parsedData;
            } catch (error) {
              console.error('Error in API request:', error);
              throw error;
            }
          },
          update: async (
            params: UpdateRegistryCacheInput,
            fetchOptions?: RequestInit,
          ): Promise<RegistryCacheConfigResponseBody> => {
            try {
              if (!apiUrl || typeof apiUrl !== 'string') {
                throw new Error('API URL is undefined or not a string');
              }
              const url = new URL(
                `${apiUrl}/system/cache/registry/update`,
                typeof window !== 'undefined' ? window.location.origin : undefined,
              );

              const options: RequestInit = {
                method: 'PUT',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                ...fetchOptions,
              };
              const validatedBody = UpdateRegistryCacheInputSchema.parse(params);
              options.body = JSON.stringify(validatedBody);
              const response = await fetchFn(url.toString(), options);
              if (!response.ok) {
                console.log(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
                const data = await response.json();
                console.log(`GO API request error`, data);
                console.log(`Request URL is:`, url.toString());
                console.log(`Request body is:`, validatedBody);
                let errorMessage =
                  '`GO API request failed with status ${response.status}: ${response.statusText}`';
                if (
                  data &&
                  Array.isArray(data.details) &&
                  data.details.length > 0 &&
                  typeof data.details[0] === 'string'
                ) {
                  errorMessage = data.details[0];
                }
                throw new Error(errorMessage);
              }
              const data = await response.json();
              const { data: parsedData, error } =
                RegistryCacheConfigResponseBodySchema.safeParse(data);
              if (error) {
                console.error('Response validation error:', error);
                console.error('Response data:', data);
                throw new Error(error.message);
              }
              return parsedData;
            } catch (error) {
              console.error('Error in API request:', error);
              throw error;
            }
          },
        },
      },
      dns: {
        check: async (
          params: z.infer<typeof check_dns_resolutionQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<DnsCheckResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(
              `${apiUrl}/system/dns/check`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );
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
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = DnsCheckResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
      },
      domain: {
        check: async (
          params?: undefined,
          fetchOptions?: RequestInit,
        ): Promise<CheckUniqueDomainOutputBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(
              `${apiUrl}/system/domain/check`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = CheckUniqueDomainOutputBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        generate: async (
          params: GenerateWildcardDomainInputBody,
          fetchOptions?: RequestInit,
        ): Promise<GenerateWildcardDomainOutputBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(
              `${apiUrl}/system/domain/generate`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };
            const validatedBody = GenerateWildcardDomainInputBodySchema.parse(params);
            options.body = JSON.stringify(validatedBody);
            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());
              console.log(`Request body is:`, validatedBody);
              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } =
              GenerateWildcardDomainOutputBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
          const url = new URL(
            `${apiUrl}/system/get`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = SystemMetaResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      registries: {
        create: async (
          params: CreateRegistryInput,
          fetchOptions?: RequestInit,
        ): Promise<CreateRegistryResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(
              `${apiUrl}/system/registries/create`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };
            const validatedBody = CreateRegistryInputSchema.parse(params);
            options.body = JSON.stringify(validatedBody);
            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());
              console.log(`Request body is:`, validatedBody);
              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = CreateRegistryResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        delete: async (params: DeleteRegistryInput, fetchOptions?: RequestInit) => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(
              `${apiUrl}/system/registries/delete`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'DELETE',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };
            const validatedBody = DeleteRegistryInputSchema.parse(params);
            options.body = JSON.stringify(validatedBody);
            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());
              console.log(`Request body is:`, validatedBody);
              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            return data;
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        get: async (
          params: z.infer<typeof get_registryQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<GetRegistryResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(
              `${apiUrl}/system/registries/get`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );
            const validatedQuery = get_registryQuerySchema.parse(params);
            const queryKeys = ['id'];
            queryKeys.forEach((key) => {
              const value = validatedQuery[key as keyof typeof validatedQuery];
              if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
              }
            });
            const options: RequestInit = {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = GetRegistryResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        list: async (
          params?: undefined,
          fetchOptions?: RequestInit,
        ): Promise<ListRegistriesResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(
              `${apiUrl}/system/registries/list`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = ListRegistriesResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        setDefault: async (
          params: SetDefaultRegistryInput,
          fetchOptions?: RequestInit,
        ): Promise<SetDefaultRegistryResponseBody> => {
          try {
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }
            const url = new URL(
              `${apiUrl}/system/registries/set-default`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };
            const validatedBody = SetDefaultRegistryInputSchema.parse(params);
            options.body = JSON.stringify(validatedBody);
            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());
              console.log(`Request body is:`, validatedBody);
              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } =
              SetDefaultRegistryResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
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
            const url = new URL(
              `${apiUrl}/system/settings/update`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'PUT',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };
            const validatedBody = SystemSettingUpdateInputSchema.parse(params);
            options.body = JSON.stringify(validatedBody);
            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());
              console.log(`Request body is:`, validatedBody);
              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = SettingsResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
            const url = new URL(
              `${apiUrl}/system/update/apply`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };
            const validatedBody = UpdateApplyInputBodySchema.parse(params);
            options.body = JSON.stringify(validatedBody);
            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());
              console.log(`Request body is:`, validatedBody);
              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = UpdateApplyResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
            const url = new URL(
              `${apiUrl}/system/update/check`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = UpdateCheckResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
            const url = new URL(
              `${apiUrl}/system/update/status`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } = UpdateStatusResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
          const url = new URL(
            `${apiUrl}/teams/get`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GetTeamResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/teams/list`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = TeamResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/teams/update`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = UpdateTeamInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = UpdateTeamResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/templates/deploy`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = TemplateDeployInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = TemplateDeployResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/templates/get`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GetTemplateResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/templates/list`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = ListTemplatesResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    terminal: {
      exec: async (
        params: z.infer<typeof exec_terminalQuerySchema>,
        fetchOptions?: RequestInit,
      ) => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/terminal/exec`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
          const validatedQuery = exec_terminalQuerySchema.parse(params);
          const queryKeys = [
            'team_id',
            'project_id',
            'environment_id',
            'service_id',
            'pod_name',
            'container',
          ];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          return data;
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
          const url = new URL(
            `${apiUrl}/unbindwebhooks/create`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = WebhookCreateInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = CreateWebhookResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/unbindwebhooks/delete`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = DeleteWebhookInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = DeleteWebhookResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/unbindwebhooks/get`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = GetWebhookResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/unbindwebhooks/list`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = ListWebhooksResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/unbindwebhooks/update`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = WebhookUpdateInputSchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = UpdateWebhookResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    users: {
      create: async (
        params: UserCreateInputBody,
        fetchOptions?: RequestInit,
      ): Promise<UserCreateResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/users/create`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = UserCreateInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = UserCreateResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      delete: async (
        params: DeleteUserInputBody,
        fetchOptions?: RequestInit,
      ): Promise<DeleteUserResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/users/delete`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = DeleteUserInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = DeleteUserResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      groups: async (
        params: z.infer<typeof list_user_groupsQuerySchema>,
        fetchOptions?: RequestInit,
      ): Promise<ListUserGroupsResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/users/groups`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
          const validatedQuery = list_user_groupsQuerySchema.parse(params);
          const queryKeys = ['user_id'];
          queryKeys.forEach((key) => {
            const value = validatedQuery[key as keyof typeof validatedQuery];
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = ListUserGroupsResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      list: async (
        params?: undefined,
        fetchOptions?: RequestInit,
      ): Promise<ListUsersResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/users/list`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = ListUsersResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      me: async (params?: undefined, fetchOptions?: RequestInit): Promise<MeResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/users/me`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = MeResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
      updatePassword: async (
        params: UpdatePasswordInputBody,
        fetchOptions?: RequestInit,
      ): Promise<UpdatePasswordResponseBody> => {
        try {
          if (!apiUrl || typeof apiUrl !== 'string') {
            throw new Error('API URL is undefined or not a string');
          }
          const url = new URL(
            `${apiUrl}/users/update-password`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = UpdatePasswordInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = UpdatePasswordResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/variables/delete`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = DeleteVariablesInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = VariablesResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
          const url = new URL(
            `${apiUrl}/variables/list`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );
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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };

          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());

            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = VariablesResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
              const url = new URL(
                `${apiUrl}/variables/references/available`,
                typeof window !== 'undefined' ? window.location.origin : undefined,
              );
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
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                ...fetchOptions,
              };

              const response = await fetchFn(url.toString(), options);
              if (!response.ok) {
                console.log(
                  `GO API request failed with status ${response.status}: ${response.statusText}`,
                );
                const data = await response.json();
                console.log(`GO API request error`, data);
                console.log(`Request URL is:`, url.toString());

                let errorMessage =
                  '`GO API request failed with status ${response.status}: ${response.statusText}`';
                if (
                  data &&
                  Array.isArray(data.details) &&
                  data.details.length > 0 &&
                  typeof data.details[0] === 'string'
                ) {
                  errorMessage = data.details[0];
                }
                throw new Error(errorMessage);
              }
              const data = await response.json();
              const { data: parsedData, error } =
                ReferenceableVariablesResponseBodySchema.safeParse(data);
              if (error) {
                console.error('Response validation error:', error);
                console.error('Response data:', data);
                throw new Error(error.message);
              }
              return parsedData;
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
                const url = new URL(
                  `${apiUrl}/variables/references/available/get`,
                  typeof window !== 'undefined' ? window.location.origin : undefined,
                );
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
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  ...fetchOptions,
                };

                const response = await fetchFn(url.toString(), options);
                if (!response.ok) {
                  console.log(
                    `GO API request failed with status ${response.status}: ${response.statusText}`,
                  );
                  const data = await response.json();
                  console.log(`GO API request error`, data);
                  console.log(`Request URL is:`, url.toString());

                  let errorMessage =
                    '`GO API request failed with status ${response.status}: ${response.statusText}`';
                  if (
                    data &&
                    Array.isArray(data.details) &&
                    data.details.length > 0 &&
                    typeof data.details[0] === 'string'
                  ) {
                    errorMessage = data.details[0];
                  }
                  throw new Error(errorMessage);
                }
                const data = await response.json();
                const { data: parsedData, error } =
                  ResolveAvailableVariableReferenceResponseBodySchema.safeParse(data);
                if (error) {
                  console.error('Response validation error:', error);
                  console.error('Response data:', data);
                  throw new Error(error.message);
                }
                return parsedData;
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
            const url = new URL(
              `${apiUrl}/variables/referneces/get`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );
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
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
            }
            const data = await response.json();
            const { data: parsedData, error } =
              ResolveVariableReferenceResponseBodySchema.safeParse(data);
            if (error) {
              console.error('Response validation error:', error);
              console.error('Response data:', data);
              throw new Error(error.message);
            }
            return parsedData;
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
          const url = new URL(
            `${apiUrl}/variables/update`,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          );

          const options: RequestInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            ...fetchOptions,
          };
          const validatedBody = UpsertVariablesInputBodySchema.parse(params);
          options.body = JSON.stringify(validatedBody);
          const response = await fetchFn(url.toString(), options);
          if (!response.ok) {
            console.log(
              `GO API request failed with status ${response.status}: ${response.statusText}`,
            );
            const data = await response.json();
            console.log(`GO API request error`, data);
            console.log(`Request URL is:`, url.toString());
            console.log(`Request body is:`, validatedBody);
            let errorMessage =
              '`GO API request failed with status ${response.status}: ${response.statusText}`';
            if (
              data &&
              Array.isArray(data.details) &&
              data.details.length > 0 &&
              typeof data.details[0] === 'string'
            ) {
              errorMessage = data.details[0];
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          const { data: parsedData, error } = VariablesResponseBodySchema.safeParse(data);
          if (error) {
            console.error('Response validation error:', error);
            console.error('Response data:', data);
            throw new Error(error.message);
          }
          return parsedData;
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
            const url = new URL(
              `${apiUrl}/webhook/github`,
              typeof window !== 'undefined' ? window.location.origin : undefined,
            );

            const options: RequestInit = {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              ...fetchOptions,
            };

            const response = await fetchFn(url.toString(), options);
            if (!response.ok) {
              console.log(
                `GO API request failed with status ${response.status}: ${response.statusText}`,
              );
              const data = await response.json();
              console.log(`GO API request error`, data);
              console.log(`Request URL is:`, url.toString());

              let errorMessage =
                '`GO API request failed with status ${response.status}: ${response.statusText}`';
              if (
                data &&
                Array.isArray(data.details) &&
                data.details.length > 0 &&
                typeof data.details[0] === 'string'
              ) {
                errorMessage = data.details[0];
              }
              throw new Error(errorMessage);
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
                const url = new URL(
                  `${apiUrl}/webhook/github/app/save`,
                  typeof window !== 'undefined' ? window.location.origin : undefined,
                );
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
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  ...fetchOptions,
                };

                const response = await fetchFn(url.toString(), options);
                if (!response.ok) {
                  console.log(
                    `GO API request failed with status ${response.status}: ${response.statusText}`,
                  );
                  const data = await response.json();
                  console.log(`GO API request error`, data);
                  console.log(`Request URL is:`, url.toString());

                  let errorMessage =
                    '`GO API request failed with status ${response.status}: ${response.statusText}`';
                  if (
                    data &&
                    Array.isArray(data.details) &&
                    data.details.length > 0 &&
                    typeof data.details[0] === 'string'
                  ) {
                    errorMessage = data.details[0];
                  }
                  throw new Error(errorMessage);
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
