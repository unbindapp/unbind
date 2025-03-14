import { z } from 'zod';

export const CallbackResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    access_token: z.string(),
    expiry: z.string(),
    id_token: z.string(),
    refresh_token: z.string(),
    token_type: z.string(),
  })
  .strict();

export const CreateProjectInputBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    description: z.string(),
    display_name: z.string(),
    name: z.string(),
  })
  .strict();

export const ProjectResponseSchema = z
  .object({
    created_at: z.string(),
    description: z.string(),
    display_name: z.string(),
    id: z.string(),
    name: z.string(),
    status: z.string(),
    team_id: z.string(),
  })
  .strict();

export const CreateProjectResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    data: ProjectResponseSchema,
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
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    detail: z.string().optional(), // A human-readable explanation specific to this occurrence of the problem.
    errors: z.array(ErrorDetailSchema).nullable().optional(), // Optional list of individual error details
    instance: z.string().optional(), // A URI reference that identifies the specific occurrence of the problem.
    status: z.number().optional(), // HTTP status code
    title: z.string().optional(), // A short, human-readable summary of the problem type. This value should not change between occurrences of the error.
    type: z.string().optional(), // A URI reference to human-readable documentation for the error.
  })
  .strict();

export const GetTeamResponseSchema = z
  .object({
    created_at: z.string(),
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
    dependabot_security_updates_enabled_for_new_repositories: z
      .boolean()
      .optional(),
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
    secret_scanning_push_protection_enabled_for_new_repositories: z
      .boolean()
      .optional(),
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
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
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
    owner: GithubRepositoryOwnerSchema,
  })
  .strict();

export const GithubAdminRepositoryListResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    data: z.array(GithubRepositorySchema).nullable(),
  })
  .strict();

export const GithubInstallationEdgesSchema = z
  .object({
    github_app: z.lazy(() => GithubAppSchema).optional(),
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

export const ProjectEdgesSchema = z
  .object({
    team: z.lazy(() => TeamSchema).optional(),
  })
  .strict();

export const ProjectSchema = z
  .object({
    created_at: z.string().optional(),
    description: z.string().optional(),
    display_name: z.string().optional(),
    edges: ProjectEdgesSchema,
    id: z.string(),
    name: z.string().optional(),
    status: z.string().optional(),
    team_id: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export const TeamEdgesSchema = z
  .object({
    groups: z
      .array(z.lazy(() => GroupSchema))
      .nullable()
      .optional(),
    members: z
      .array(z.lazy(() => UserSchema))
      .nullable()
      .optional(),
    projects: z.array(ProjectSchema).nullable().optional(),
  })
  .strict();

export const TeamSchema: z.ZodType<unknown> = z
  .object({
    created_at: z.string().optional(),
    description: z.string().optional(),
    display_name: z.string().optional(),
    edges: TeamEdgesSchema,
    id: z.string(),
    name: z.string().optional(),
    namespace: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict();

export const GroupEdgesSchema = z
  .object({
    permissions: z.array(PermissionSchema).nullable().optional(),
    team: TeamSchema.optional(),
    users: z
      .array(z.lazy(() => UserSchema))
      .nullable()
      .optional(),
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
    created_by: z
      .array(z.lazy(() => GithubAppSchema))
      .nullable()
      .optional(),
    groups: z.array(GroupSchema).nullable().optional(),
    oauth2_codes: z.array(Oauth2CodeSchema).nullable().optional(),
    oauth2_tokens: z.array(Oauth2TokenSchema).nullable().optional(),
    teams: z.array(TeamSchema).nullable().optional(),
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

export const GithubAppEdgesSchema = z
  .object({
    installations: z.array(GithubInstallationSchema).nullable().optional(),
    users: UserSchema.optional(),
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

export const GithubAppCreateResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    data: z.string(),
  })
  .strict();

export const GithubAppInstallationListResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    data: z.array(GithubInstallationSchema).nullable(),
  })
  .strict();

export const GithubAppListResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    data: z.array(GithubAppSchema).nullable(),
  })
  .strict();

export const HealthResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    status: z.string(),
  })
  .strict();

export const ListProjectResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    data: z.array(ProjectResponseSchema).nullable(),
  })
  .strict();

export const MeResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    data: UserSchema,
  })
  .strict();

export const TeamResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    data: z.array(GetTeamResponseSchema).nullable(),
  })
  .strict();

export const UpdateProjectInputBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    description: z.string(),
    display_name: z.string(),
  })
  .strict();

export const UpdateProjectResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    data: ProjectResponseSchema,
  })
  .strict();

export const UpdateTeamInputBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    display_name: z.string(),
  })
  .strict();

export const UpdateTeamResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    data: GetTeamResponseSchema,
  })
  .strict();

export type CallbackResponseBody = z.infer<typeof CallbackResponseBodySchema>;
export type CreateProjectInputBody = z.infer<
  typeof CreateProjectInputBodySchema
>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type CreateProjectResponseBody = z.infer<
  typeof CreateProjectResponseBodySchema
>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type ErrorModel = z.infer<typeof ErrorModelSchema>;
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
export type GithubInstallationEdges = z.infer<
  typeof GithubInstallationEdgesSchema
>;
export type GithubInstallationPermissions = z.infer<
  typeof GithubInstallationPermissionsSchema
>;
export type GithubInstallation = z.infer<typeof GithubInstallationSchema>;
export type PermissionEdges = z.infer<typeof PermissionEdgesSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type ProjectEdges = z.infer<typeof ProjectEdgesSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type TeamEdges = z.infer<typeof TeamEdgesSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type GroupEdges = z.infer<typeof GroupEdgesSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type Oauth2CodeEdges = z.infer<typeof Oauth2CodeEdgesSchema>;
export type Oauth2Code = z.infer<typeof Oauth2CodeSchema>;
export type Oauth2TokenEdges = z.infer<typeof Oauth2TokenEdgesSchema>;
export type Oauth2Token = z.infer<typeof Oauth2TokenSchema>;
export type UserEdges = z.infer<typeof UserEdgesSchema>;
export type User = z.infer<typeof UserSchema>;
export type GithubAppEdges = z.infer<typeof GithubAppEdgesSchema>;
export type GithubApp = z.infer<typeof GithubAppSchema>;
export type GithubAppCreateResponseBody = z.infer<
  typeof GithubAppCreateResponseBodySchema
>;
export type GithubAppInstallationListResponseBody = z.infer<
  typeof GithubAppInstallationListResponseBodySchema
>;
export type GithubAppListResponseBody = z.infer<
  typeof GithubAppListResponseBodySchema
>;
export type HealthResponseBody = z.infer<typeof HealthResponseBodySchema>;
export type ListProjectResponseBody = z.infer<
  typeof ListProjectResponseBodySchema
>;
export type MeResponseBody = z.infer<typeof MeResponseBodySchema>;
export type TeamResponseBody = z.infer<typeof TeamResponseBodySchema>;
export type UpdateProjectInputBody = z.infer<
  typeof UpdateProjectInputBodySchema
>;
export type UpdateProjectResponseBody = z.infer<
  typeof UpdateProjectResponseBodySchema
>;
export type UpdateTeamInputBody = z.infer<typeof UpdateTeamInputBodySchema>;
export type UpdateTeamResponseBody = z.infer<
  typeof UpdateTeamResponseBodySchema
>;

export const callbackQuerySchema = z.object({
  code: z.string(),
});

export const app_createQuerySchema = z.object({
  redirect_url: z.string(), // The client URL to redirect to after the installation is finished
  organization: z.string().optional(), // The organization to install the app for, if any
});

export const list_appsQuerySchema = z.object({
  with_installations: z.boolean().optional(),
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
      callback: {
        get: async (
          query: z.infer<typeof callbackQuerySchema>,
          fetchOptions?: RequestInit,
        ): Promise<CallbackResponseBody> => {
          try {
            // Make sure apiUrl is defined and is a string
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }

            const url = new URL(`${apiUrl}/auth/callback`);
            const validatedQuery = callbackQuerySchema.parse(query);
            // Only process if validatedQuery is an object
            if (validatedQuery && typeof validatedQuery === 'object') {
              Object.entries(validatedQuery).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                  url.searchParams.append(key, String(value));
                }
              });
            }

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
              throw new Error(
                `API request failed with status ${response.status}: ${response.statusText}`,
              );
            }

            const data = await response.json();
            return CallbackResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
      },
      login: {
        get: async (fetchOptions?: RequestInit) => {
          try {
            // Make sure apiUrl is defined and is a string
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
              throw new Error(
                `API request failed with status ${response.status}: ${response.statusText}`,
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
    github: {
      app: {
        create: {
          get: async (
            query: z.infer<typeof app_createQuerySchema>,
            fetchOptions?: RequestInit,
          ): Promise<GithubAppCreateResponseBody> => {
            try {
              // Make sure apiUrl is defined and is a string
              if (!apiUrl || typeof apiUrl !== 'string') {
                throw new Error('API URL is undefined or not a string');
              }

              const url = new URL(`${apiUrl}/github/app/create`);
              const validatedQuery = app_createQuerySchema.parse(query);
              // Only process if validatedQuery is an object
              if (validatedQuery && typeof validatedQuery === 'object') {
                Object.entries(validatedQuery).forEach(([key, value]) => {
                  if (value !== undefined && value !== null) {
                    url.searchParams.append(key, String(value));
                  }
                });
              }

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
                throw new Error(
                  `API request failed with status ${response.status}: ${response.statusText}`,
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
      },
      apps: {
        get: async (
          query: z.infer<typeof list_appsQuerySchema> = {},
          fetchOptions?: RequestInit,
        ): Promise<GithubAppListResponseBody> => {
          try {
            // Make sure apiUrl is defined and is a string
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }

            const url = new URL(`${apiUrl}/github/apps`);
            const validatedQuery = list_appsQuerySchema.parse(query);
            // Only process if validatedQuery is an object
            if (validatedQuery && typeof validatedQuery === 'object') {
              Object.entries(validatedQuery).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                  url.searchParams.append(key, String(value));
                }
              });
            }

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
              throw new Error(
                `API request failed with status ${response.status}: ${response.statusText}`,
              );
            }

            const data = await response.json();
            return GithubAppListResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
      },
      installation: {
        installationId: (installationId: string | number) => ({
          organizations: {
            get: async (
              fetchOptions?: RequestInit,
            ): Promise<GithubAdminOrganizationListResponseBody> => {
              try {
                // Make sure apiUrl is defined and is a string
                if (!apiUrl || typeof apiUrl !== 'string') {
                  throw new Error('API URL is undefined or not a string');
                }

                const url = new URL(
                  `${apiUrl}/github/installation/${installationId}/organizations`,
                );

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
                  throw new Error(
                    `API request failed with status ${response.status}: ${response.statusText}`,
                  );
                }

                const data = await response.json();
                return GithubAdminOrganizationListResponseBodySchema.parse(
                  data,
                );
              } catch (error) {
                console.error('Error in API request:', error);
                throw error;
              }
            },
          },
        }),
      },
      installations: {
        get: async (
          fetchOptions?: RequestInit,
        ): Promise<GithubAppInstallationListResponseBody> => {
          try {
            // Make sure apiUrl is defined and is a string
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
              throw new Error(
                `API request failed with status ${response.status}: ${response.statusText}`,
              );
            }

            const data = await response.json();
            return GithubAppInstallationListResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
      },
      repositories: {
        get: async (
          fetchOptions?: RequestInit,
        ): Promise<GithubAdminRepositoryListResponseBody> => {
          try {
            // Make sure apiUrl is defined and is a string
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
              throw new Error(
                `API request failed with status ${response.status}: ${response.statusText}`,
              );
            }

            const data = await response.json();
            return GithubAdminRepositoryListResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
      },
    },
    health: {
      get: async (fetchOptions?: RequestInit): Promise<HealthResponseBody> => {
        try {
          // Make sure apiUrl is defined and is a string
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
            throw new Error(
              `API request failed with status ${response.status}: ${response.statusText}`,
            );
          }

          const data = await response.json();
          return HealthResponseBodySchema.parse(data);
        } catch (error) {
          console.error('Error in API request:', error);
          throw error;
        }
      },
    },
    teams: {
      list: {
        get: async (fetchOptions?: RequestInit): Promise<TeamResponseBody> => {
          try {
            // Make sure apiUrl is defined and is a string
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
              throw new Error(
                `API request failed with status ${response.status}: ${response.statusText}`,
              );
            }

            const data = await response.json();
            return TeamResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
      },
      teamId: (teamId: string | number) => ({
        put: async (
          body: UpdateTeamInputBody,
          fetchOptions?: RequestInit,
        ): Promise<UpdateTeamResponseBody> => {
          try {
            // Make sure apiUrl is defined and is a string
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }

            const url = new URL(`${apiUrl}/teams/${teamId}`);

            const options: RequestInit = {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              ...fetchOptions,
            };
            if (body !== undefined) {
              const validatedBody = UpdateTeamInputBodySchema.parse(body);
              options.body = JSON.stringify(validatedBody);
            }

            const response = await fetch(url.toString(), options);

            if (!response.ok) {
              throw new Error(
                `API request failed with status ${response.status}: ${response.statusText}`,
              );
            }

            const data = await response.json();
            return UpdateTeamResponseBodySchema.parse(data);
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        project: {
          create: {
            post: async (
              body: CreateProjectInputBody,
              fetchOptions?: RequestInit,
            ): Promise<CreateProjectResponseBody> => {
              try {
                // Make sure apiUrl is defined and is a string
                if (!apiUrl || typeof apiUrl !== 'string') {
                  throw new Error('API URL is undefined or not a string');
                }

                const url = new URL(`${apiUrl}/teams/${teamId}/project/create`);

                const options: RequestInit = {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                  },
                  ...fetchOptions,
                };
                if (body !== undefined) {
                  const validatedBody =
                    CreateProjectInputBodySchema.parse(body);
                  options.body = JSON.stringify(validatedBody);
                }

                const response = await fetch(url.toString(), options);

                if (!response.ok) {
                  throw new Error(
                    `API request failed with status ${response.status}: ${response.statusText}`,
                  );
                }

                const data = await response.json();
                return CreateProjectResponseBodySchema.parse(data);
              } catch (error) {
                console.error('Error in API request:', error);
                throw error;
              }
            },
          },
          list: {
            get: async (
              fetchOptions?: RequestInit,
            ): Promise<ListProjectResponseBody> => {
              try {
                // Make sure apiUrl is defined and is a string
                if (!apiUrl || typeof apiUrl !== 'string') {
                  throw new Error('API URL is undefined or not a string');
                }

                const url = new URL(`${apiUrl}/teams/${teamId}/project/list`);

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
                  throw new Error(
                    `API request failed with status ${response.status}: ${response.statusText}`,
                  );
                }

                const data = await response.json();
                return ListProjectResponseBodySchema.parse(data);
              } catch (error) {
                console.error('Error in API request:', error);
                throw error;
              }
            },
          },
          projectId: (projectId: string | number) => ({
            update: {
              put: async (
                body: UpdateProjectInputBody,
                fetchOptions?: RequestInit,
              ): Promise<UpdateProjectResponseBody> => {
                try {
                  // Make sure apiUrl is defined and is a string
                  if (!apiUrl || typeof apiUrl !== 'string') {
                    throw new Error('API URL is undefined or not a string');
                  }

                  const url = new URL(
                    `${apiUrl}/teams/${teamId}/project/${projectId}/update`,
                  );

                  const options: RequestInit = {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${accessToken}`,
                    },
                    ...fetchOptions,
                  };
                  if (body !== undefined) {
                    const validatedBody =
                      UpdateProjectInputBodySchema.parse(body);
                    options.body = JSON.stringify(validatedBody);
                  }

                  const response = await fetch(url.toString(), options);

                  if (!response.ok) {
                    throw new Error(
                      `API request failed with status ${response.status}: ${response.statusText}`,
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
          }),
        },
      }),
    },
    user: {
      me: {
        get: async (fetchOptions?: RequestInit): Promise<MeResponseBody> => {
          try {
            // Make sure apiUrl is defined and is a string
            if (!apiUrl || typeof apiUrl !== 'string') {
              throw new Error('API URL is undefined or not a string');
            }

            const url = new URL(`${apiUrl}/user/me`);

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
              throw new Error(
                `API request failed with status ${response.status}: ${response.statusText}`,
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
    },
    webhook: {
      github: {
        post: async (fetchOptions?: RequestInit) => {
          try {
            // Make sure apiUrl is defined and is a string
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
              throw new Error(
                `API request failed with status ${response.status}: ${response.statusText}`,
              );
            }

            const data = await response.json();
            return data;
          } catch (error) {
            console.error('Error in API request:', error);
            throw error;
          }
        },
        app: {
          save: {
            get: async (
              query: z.infer<typeof app_saveQuerySchema>,
              fetchOptions?: RequestInit,
            ) => {
              try {
                // Make sure apiUrl is defined and is a string
                if (!apiUrl || typeof apiUrl !== 'string') {
                  throw new Error('API URL is undefined or not a string');
                }

                const url = new URL(`${apiUrl}/webhook/github/app/save`);
                const validatedQuery = app_saveQuerySchema.parse(query);
                // Only process if validatedQuery is an object
                if (validatedQuery && typeof validatedQuery === 'object') {
                  Object.entries(validatedQuery).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                      url.searchParams.append(key, String(value));
                    }
                  });
                }

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
                  throw new Error(
                    `API request failed with status ${response.status}: ${response.statusText}`,
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
      },
    },
  };
}
