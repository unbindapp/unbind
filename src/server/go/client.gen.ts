import { z } from 'zod';

export const CallbackResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    access_token: z.string(),
    expiry: z.string(),
    refresh_token: z.string(),
    token_type: z.string(),
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
    oauth2_codes: z.array(Oauth2CodeSchema).nullable().optional(),
    oauth2_tokens: z.array(Oauth2TokenSchema).nullable().optional(),
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

export const MeResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    data: UserSchema,
  })
  .strict();

export const UnbindTeamSchema = z
  .object({
    created_at: z.string(),
    name: z.string(),
    namespace: z.string(),
  })
  .strict();

export const TeamResponseBodySchema = z
  .object({
    $schema: z.string().optional(), // A URL to the JSON Schema for this object.
    data: z.array(UnbindTeamSchema).nullable(),
  })
  .strict();

export type CallbackResponseBody = z.infer<typeof CallbackResponseBodySchema>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type ErrorModel = z.infer<typeof ErrorModelSchema>;
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
export type Oauth2CodeEdges = z.infer<typeof Oauth2CodeEdgesSchema>;
export type Oauth2Code = z.infer<typeof Oauth2CodeSchema>;
export type Oauth2TokenEdges = z.infer<typeof Oauth2TokenEdgesSchema>;
export type Oauth2Token = z.infer<typeof Oauth2TokenSchema>;
export type UserEdges = z.infer<typeof UserEdgesSchema>;
export type User = z.infer<typeof UserSchema>;
export type GithubAppEdges = z.infer<typeof GithubAppEdgesSchema>;
export type GithubApp = z.infer<typeof GithubAppSchema>;
export type GithubAppInstallationListResponseBody = z.infer<
  typeof GithubAppInstallationListResponseBodySchema
>;
export type GithubAppListResponseBody = z.infer<
  typeof GithubAppListResponseBodySchema
>;
export type HealthResponseBody = z.infer<typeof HealthResponseBodySchema>;
export type MeResponseBody = z.infer<typeof MeResponseBodySchema>;
export type UnbindTeam = z.infer<typeof UnbindTeamSchema>;
export type TeamResponseBody = z.infer<typeof TeamResponseBodySchema>;

export const get_callbackQuerySchema = z.object({
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
        get: async (query: z.infer<typeof get_callbackQuerySchema>) => {
          const baseUrl = `${apiUrl}/auth/callback`;
          const validatedQuery = get_callbackQuerySchema.parse(query);
          const queryString = new URLSearchParams(
            validatedQuery as Record<string, string>,
          ).toString();
          const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          };

          const response = await fetch(url, options);
          const data = await response.json();
          return CallbackResponseBodySchema.parse(data);
        },
      },
      login: {
        get: async () => {
          const baseUrl = `${apiUrl}/auth/login`;

          const url = baseUrl;
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          };

          const response = await fetch(url, options);
          const data = await response.json();
          return data;
        },
      },
    },
    github: {
      app: {
        create: {
          get: async (query: z.infer<typeof app_createQuerySchema>) => {
            const baseUrl = `${apiUrl}/github/app/create`;
            const validatedQuery = app_createQuerySchema.parse(query);
            const queryString = new URLSearchParams(
              validatedQuery as Record<string, string>,
            ).toString();
            const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
            const options: RequestInit = {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
            };

            const response = await fetch(url, options);
            const data = await response.json();
            return data;
          },
        },
      },
      apps: {
        get: async (query: z.infer<typeof list_appsQuerySchema>) => {
          const baseUrl = `${apiUrl}/github/apps`;
          const validatedQuery = list_appsQuerySchema.parse(query);
          const queryString = new URLSearchParams(
            validatedQuery as Record<string, string>,
          ).toString();
          const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          };

          const response = await fetch(url, options);
          const data = await response.json();
          return GithubAppListResponseBodySchema.parse(data);
        },
      },
      installation: {
        ByInstallation_id: {
          organizations: {
            get: async () => {
              const baseUrl = `${apiUrl}/github/installation/{installation_id}/organizations`;

              const url = baseUrl;
              const options: RequestInit = {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${accessToken}`,
                },
              };

              const response = await fetch(url, options);
              const data = await response.json();
              return GithubAdminOrganizationListResponseBodySchema.parse(data);
            },
          },
        },
      },
      installations: {
        get: async () => {
          const baseUrl = `${apiUrl}/github/installations`;

          const url = baseUrl;
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          };

          const response = await fetch(url, options);
          const data = await response.json();
          return GithubAppInstallationListResponseBodySchema.parse(data);
        },
      },
      repositories: {
        get: async () => {
          const baseUrl = `${apiUrl}/github/repositories`;

          const url = baseUrl;
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          };

          const response = await fetch(url, options);
          const data = await response.json();
          return GithubAdminRepositoryListResponseBodySchema.parse(data);
        },
      },
    },
    healthz: {
      get: async () => {
        const baseUrl = `${apiUrl}/healthz`;

        const url = baseUrl;
        const options: RequestInit = {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        };

        const response = await fetch(url, options);
        const data = await response.json();
        return HealthResponseBodySchema.parse(data);
      },
    },
    teams: {
      get: async () => {
        const baseUrl = `${apiUrl}/teams`;

        const url = baseUrl;
        const options: RequestInit = {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        };

        const response = await fetch(url, options);
        const data = await response.json();
        return TeamResponseBodySchema.parse(data);
      },
    },
    user: {
      me: {
        get: async () => {
          const baseUrl = `${apiUrl}/user/me`;

          const url = baseUrl;
          const options: RequestInit = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          };

          const response = await fetch(url, options);
          const data = await response.json();
          return MeResponseBodySchema.parse(data);
        },
      },
    },
    webhook: {
      github: {
        post: async () => {
          const baseUrl = `${apiUrl}/webhook/github`;

          const url = baseUrl;
          const options: RequestInit = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          };

          const response = await fetch(url, options);
          const data = await response.json();
          return data;
        },
        app: {
          save: {
            get: async (query: z.infer<typeof app_saveQuerySchema>) => {
              const baseUrl = `${apiUrl}/webhook/github/app/save`;
              const validatedQuery = app_saveQuerySchema.parse(query);
              const queryString = new URLSearchParams(
                validatedQuery as Record<string, string>,
              ).toString();
              const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
              const options: RequestInit = {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${accessToken}`,
                },
              };

              const response = await fetch(url, options);
              const data = await response.json();
              return data;
            },
          },
        },
      },
    },
  };
}
