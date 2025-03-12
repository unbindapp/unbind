import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const mainRouter = createTRPCRouter({
  getTeams: publicProcedure.input(z.object({})).query(async function () {
    return {
      teams,
    };
  }),
  getProjects: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
      }),
    )
    .query(async function ({ input: { teamId } }) {
      const projects = await getProjects({ teamId });
      return {
        projects,
      };
    }),
  getServices: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        projectId: z.string(),
        environmentId: z.string(),
      }),
    )
    .query(async function ({ input: { teamId, projectId, environmentId } }) {
      const project = projects.find((p) => p.id === projectId && p.teamId === teamId);
      if (!project) {
        throw new Error("Project not found");
      }
      const environment = project.environments.find((e) => e.id === environmentId);
      if (!environment) {
        throw new Error("Environment not found");
      }
      return {
        services: environment.services,
      };
    }),
  getDeployments: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        projectId: z.string(),
        environmentId: z.string(),
        serviceId: z.string(),
      }),
    )
    .query(async function ({ input: { teamId, projectId, environmentId, serviceId } }) {
      const deployments = await getDeployments({
        teamId,
        projectId,
        environmentId,
        serviceId,
      });
      return {
        deployments,
      };
    }),
  getVariables: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        projectId: z.string(),
        environmentId: z.string(),
        serviceId: z.string(),
      }),
    )
    .query(async function ({ input: { teamId, projectId, environmentId, serviceId } }) {
      const variables = await getVariables({
        teamId,
        projectId,
        environmentId,
        serviceId,
      });
      return {
        variables,
      };
    }),
  getRepos: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
      }),
    )
    .query(async function ({ input: { teamId }, ctx }) {
      console.log("teamId:", teamId);
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        });
      }
      const { data } = await goClient.github.repositories.get();
      return {
        repos: data || [],
      };
    }),
});

async function getProjects({ teamId }: { teamId: string }) {
  return projects.filter((p) => p.teamId === teamId);
}

async function getVariables({
  teamId,
  projectId,
  environmentId,
  serviceId,
}: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) {
  console.log(
    "teamId:",
    teamId,
    "projectId:",
    projectId,
    "environmentId:",
    environmentId,
    "serviceId:",
    serviceId,
  );
  return variables;
}

async function getDeployments({
  teamId,
  projectId,
  environmentId,
  serviceId,
}: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) {
  const projects = await getProjects({ teamId });
  const project = projects.find((p) => p.id === projectId);
  if (!project) {
    return null;
  }
  const environment = project.environments.find((e) => e.id === environmentId);
  if (!environment) {
    return null;
  }
  const service = environment.services.find((s) => s.id === serviceId);
  if (!service) {
    return null;
  }

  const filteredDeployments = deployments
    .filter((d) => d.source === service.source)
    .filter(
      (d) =>
        service.lastDeployment?.source === "github" ||
        (service.lastDeployment?.dockerImage &&
          d.source === "docker" &&
          d.dockerImage === service.lastDeployment.dockerImage),
    );
  return filteredDeployments;
}

const teams: TTeam[] = [
  {
    id: "5048c703-10c9-4bd8-b311-cf02b527b400",
    title: "Default",
  },
  {
    id: "e7bb6643-3f31-4b73-b71f-b3ab14b604d2",
    title: "Stablecog",
  },
  {
    id: "4f80fefe-2a65-4c13-bec1-84729b733eaf",
    title: "Appditto",
  },
];

const projects: TProject[] = [
  {
    title: "Acme",
    id: "f435d289-d8a7-4aa5-8998-106953dd6f65",
    teamId: "5048c703-10c9-4bd8-b311-cf02b527b400",
    environments: [
      {
        id: "35c0a3c5-eeca-4db1-9b6c-df598fac51a0",
        title: "production",
        services: [
          {
            id: "04a595bb-57d5-4d39-850d-5400e0adb8c9",
            teamId: "5048c703-10c9-4bd8-b311-cf02b527b400",
            projectId: "f435d289-d8a7-4aa5-8998-106953dd6f65",
            environmentId: "35c0a3c5-eeca-4db1-9b6c-df598fac51a0",
            type: "nextjs",
            source: "github",
            title: "Web App",
            lastDeployment: {
              id: "513628d7-7b2c-4174-b2b2-09ba8dbe6189",
              source: "github",
              status: "succeeded",
              timestamp: Date.now(),
              commitHash: "b2b2c3d4",
              commitMessage: "Update homepage",
            },
          },
          {
            id: "ad393e8a-c5ea-46f6-a650-144fd99bdc55",
            teamId: "5048c703-10c9-4bd8-b311-cf02b527b400",
            projectId: "f435d289-d8a7-4aa5-8998-106953dd6f65",
            environmentId: "35c0a3c5-eeca-4db1-9b6c-df598fac51a0",
            type: "postgresql",
            source: "docker",
            title: "Database",
            lastDeployment: {
              id: "e3eacef2-5364-448e-a329-258dfe01ecfc",
              source: "docker",
              status: "succeeded",
              timestamp: Date.now() - 1000 * 60 * 60 * 24,
              dockerImage: "postgres:15-alpine",
            },
          },
          {
            id: "2c93a68c-4604-4754-99b8-ffd596abd14a",
            teamId: "5048c703-10c9-4bd8-b311-cf02b527b400",
            projectId: "f435d289-d8a7-4aa5-8998-106953dd6f65",
            environmentId: "35c0a3c5-eeca-4db1-9b6c-df598fac51a0",
            type: "redis",
            source: "docker",
            title: "Cache",
            lastDeployment: {
              id: "22c3852d-b4d2-498c-afe6-32b9e4f95ec7",
              source: "docker",
              status: "succeeded",
              timestamp: Date.now() - 1000 * 60 * 60 * 24 * 14,
              dockerImage: "redis:8-alpine",
            },
          },
        ],
      },
      {
        id: "9874e025-3d22-46e4-8e86-8de6eedc3952",
        title: "development",
        services: [],
      },
    ],
  },
  {
    title: "Umbrella",
    id: "cce28aef-9c51-461f-8fc3-d777ea47c69d",
    teamId: "5048c703-10c9-4bd8-b311-cf02b527b400",
    environments: [
      {
        id: "cbe57445-aab2-4cc7-a53d-b430de647398",
        title: "production",
        services: [
          {
            id: "db8353be-6ec6-4c9d-9a6d-79cedaf5bb9e",
            teamId: "5048c703-10c9-4bd8-b311-cf02b527b400",
            projectId: "cce28aef-9c51-461f-8fc3-d777ea47c69d",
            environmentId: "cbe57445-aab2-4cc7-a53d-b430de647398",
            type: "svelte",
            source: "github",
            title: "Website",
            lastDeployment: {
              id: "7c8bffe9-18d3-4c38-8615-fb725992b766",
              source: "github",
              status: "succeeded",
              timestamp: Date.now() - 1000 * 60 * 60 * 1,
              commitHash: "a1b2c3d4",
              commitMessage: "Style tweaks",
            },
          },
          {
            id: "d5e2ee62-f30a-4b4f-9070-4f658e17b7ed",
            teamId: "5048c703-10c9-4bd8-b311-cf02b527b400",
            projectId: "cce28aef-9c51-461f-8fc3-d777ea47c69d",
            environmentId: "cbe57445-aab2-4cc7-a53d-b430de647398",
            type: "astro",
            source: "github",
            title: "Docs",
            lastDeployment: {
              id: "c8f17ad4-1989-4fde-9b0f-3ec4384d1686",
              source: "github",
              status: "succeeded",
              timestamp: Date.now() - 1000 * 60 * 60 * 5,
              commitHash: "e5f6a7b8",
              commitMessage: "Update README",
            },
          },
          {
            id: "09463e12-7e7a-45fa-913f-9200e090468a",
            teamId: "5048c703-10c9-4bd8-b311-cf02b527b400",
            projectId: "cce28aef-9c51-461f-8fc3-d777ea47c69d",
            environmentId: "cbe57445-aab2-4cc7-a53d-b430de647398",
            type: "nextjs",
            source: "github",
            title: "Umami Frontend",
            serviceGroup: {
              id: "10f5aeb7-59d1-495a-92fd-3a245566ee55",
              title: "Umami",
              type: "umami",
            },
            lastDeployment: {
              id: "14cdeb8e-5bca-44e6-9385-c4e29a809f49",
              source: "docker",
              status: "succeeded",
              timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2,
              dockerImage: "ghcr.io/umami-software/umami:postgresql-latest",
            },
          },
          {
            id: "5d6eed80-ed5e-4d67-944f-aa6d726f0ab3",
            teamId: "5048c703-10c9-4bd8-b311-cf02b527b400",
            projectId: "cce28aef-9c51-461f-8fc3-d777ea47c69d",
            environmentId: "cbe57445-aab2-4cc7-a53d-b430de647398",
            type: "postgresql",
            source: "docker",
            title: "Umami Database",
            serviceGroup: {
              id: "10f5aeb7-59d1-495a-92fd-3a245566ee55",
              title: "Umami",
              type: "umami",
            },
            lastDeployment: {
              id: "5725486e-696a-4202-9f19-89dc17275352",
              source: "docker",
              status: "succeeded",
              timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2,
              dockerImage: "postgres:16-alpine",
            },
          },
        ],
      },
    ],
  },
  {
    title: "Hamburger",
    id: "7d836bb0-8747-469e-9032-5f061cd2e696",
    teamId: "5048c703-10c9-4bd8-b311-cf02b527b400",
    environments: [
      {
        id: "6e82623a-298e-447b-8ef1-f9868e4282ba",
        title: "production",
        services: [
          {
            id: "f9d60dad-5184-43e3-a1bd-e1bfcd8575bb",
            teamId: "5048c703-10c9-4bd8-b311-cf02b527b400",
            projectId: "7d836bb0-8747-469e-9032-5f061cd2e696",
            environmentId: "6e82623a-298e-447b-8ef1-f9868e4282ba",
            type: "go",
            source: "github",
            title: "API",
            lastDeployment: {
              id: "1fd6f8ed-912f-4c52-8cd6-c09920d3265b",
              source: "github",
              status: "succeeded",
              timestamp: Date.now() - 1000 * 60 * 60 * 0.5,
              commitHash: "a1b2c3d4",
              commitMessage: "Add new endpoint",
            },
          },
          {
            id: "bd251dca-18c0-4a8b-bae9-1dfc1b00d979",
            teamId: "5048c703-10c9-4bd8-b311-cf02b527b400",
            projectId: "7d836bb0-8747-469e-9032-5f061cd2e696",
            environmentId: "6e82623a-298e-447b-8ef1-f9868e4282ba",
            type: "mysql",
            source: "docker",
            title: "DB",
            lastDeployment: {
              id: "c7977e1f-9641-4d21-9671-a7d5e4a1d506",
              source: "docker",
              status: "succeeded",
              timestamp: Date.now() - 1000 * 60 * 60 * 24 * 64,
              dockerImage: "mysql:9.2.0",
            },
          },
        ],
      },
    ],
  },
  {
    title: "Cheese",
    id: "1aab14e4-50ff-47c2-b713-46dd4b3ce723",
    teamId: "5048c703-10c9-4bd8-b311-cf02b527b400",
    environments: [
      {
        id: "577b6619-7c97-4f02-934d-82d1e80f4027",
        title: "production",
        services: [],
      },
    ],
  },
  // Different Project
  {
    title: "Web",
    id: "358e56be-3522-4409-b9f2-9aaa07fc21a7",
    teamId: "e7bb6643-3f31-4b73-b71f-b3ab14b604d2",
    environments: [
      {
        id: "cd48b702-b8bc-473e-a14a-d66d7d4bd6ec",
        title: "production",
        services: [
          {
            id: "55db768e-5879-47ba-a94d-d4a1af2a8b4c",
            teamId: "e7bb6643-3f31-4b73-b71f-b3ab14b604d2",
            projectId: "358e56be-3522-4409-b9f2-9aaa07fc21a7",
            environmentId: "cd48b702-b8bc-473e-a14a-d66d7d4bd6ec",
            title: "Website",
            type: "svelte",
            source: "github",
            lastDeployment: {
              id: "8b3deb22-0577-4ea4-9e84-88890b9fa5a8",
              source: "github",
              status: "succeeded",
              timestamp: Date.now() - 1000 * 60 * 15,
              commitHash: "a1b2c3d4",
              commitMessage: "Fix bug",
            },
          },
          {
            id: "d9f7b682-2652-49a0-8d1c-410401d661a5",
            teamId: "e7bb6643-3f31-4b73-b71f-b3ab14b604d2",
            projectId: "358e56be-3522-4409-b9f2-9aaa07fc21a7",
            environmentId: "cd48b702-b8bc-473e-a14a-d66d7d4bd6ec",
            title: "Meili DB",
            type: "meilisearch",
            source: "docker",
            lastDeployment: {
              id: "a7505101-e2cd-4cc6-b152-99be97748733",
              source: "docker",
              status: "succeeded",
              timestamp: Date.now() - 1000 * 60 * 60 * 24 * 35,
              dockerImage: "getmeili/meilisearch:latest",
            },
          },
          {
            id: "d1d6b770-5fe4-4441-a089-e08187280084",
            teamId: "e7bb6643-3f31-4b73-b71f-b3ab14b604d2",
            projectId: "358e56be-3522-4409-b9f2-9aaa07fc21a7",
            environmentId: "cd48b702-b8bc-473e-a14a-d66d7d4bd6ec",
            title: "Analytics DB",
            type: "clickhouse",
            source: "docker",
            lastDeployment: {
              id: "98b7edb0-9fdd-46df-9607-c2e44e31fa9c",
              source: "docker",
              status: "succeeded",
              timestamp: Date.now() - 1000 * 60 * 60 * 24 * 15,
              dockerImage: "bitnami/clickhouse",
            },
          },
        ],
      },
    ],
  },
];

export type TServiceType =
  | "nextjs"
  | "svelte"
  | "umami"
  | "postgresql"
  | "redis"
  | "clickhouse"
  | "go"
  | "rust"
  | "mysql"
  | "minio"
  | "meilisearch"
  | "astro"
  | "strapi"
  | "mongodb"
  | "pocketbase"
  | "ghost"
  | "n8n";

export type TGitHubRepo = {
  owner: string;
  name: string;
  isPublic: boolean;
};

export type TTeam = {
  id: string;
  title: string;
};

export type TEnvironment = {
  id: string;
  title: string;
  services: TService[];
};

export type TService = {
  id: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  title: string;
  lastDeployment?: TDeployment;
  type: TServiceType;
  serviceGroup?: TServiceGroup;
  source: TDeploymentSource;
};

export type TServiceGroup = {
  id: string;
  title: string;
  type: TServiceType;
};

export type TDeploymentSource = "github" | "docker";

export type TDeploymentStatus = "pending" | "succeeded" | "failed";

type TDeploymentShared = {
  id: string;
  status: TDeploymentStatus;
  timestamp: number;
};

export type TDeployment = TDeploymentShared &
  (
    | {
        source: "github";
        commitHash: string;
        commitMessage: string;
      }
    | {
        source: "docker";
        dockerImage: string;
      }
  );

export type TProject = {
  id: string;
  title: string;
  teamId: string;
  environments: TEnvironment[];
};

export type TVariable = {
  key: string;
  value: string;
};

const variables: TVariable[] = [
  {
    key: "DATABASE_URL",
    value: "postgres://user:password@localhost:5432/db",
  },
  {
    key: "SITE_URL",
    value: "https://example.com",
  },
  {
    key: "CLOUDFLARE_API_KEY",
    value: "1234567890",
  },
  {
    key: "AWS_ACCESS_KEY_ID",
    value: "AKIA1234567890EXAMPLE",
  },
  {
    key: "AWS_SECRET_ACCESS_KEY",
    value: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  },
  {
    key: "REDIS_URL",
    value: "redis://localhost:6379",
  },
  {
    key: "JWT_SECRET",
    value: "your-256-bit-secret-key-here",
  },
  {
    key: "SMTP_HOST",
    value: "smtp.gmail.com",
  },
  {
    key: "SMTP_PORT",
    value: "587",
  },
  {
    key: "SMTP_USER",
    value: "notifications@example.com",
  },
  {
    key: "SMTP_PASSWORD",
    value: "app-specific-password",
  },
  {
    key: "STRIPE_PUBLIC_KEY",
    value: "pk_test_1234567890",
  },
  {
    key: "STRIPE_SECRET_KEY",
    value: "sk_test_1234567890",
  },
];

const deployments: TDeployment[] = [
  {
    id: "513628d7-7b2c-4174-b2b2-09ba8dbe6189",
    source: "github",
    status: "succeeded",
    timestamp: Date.now() - 1000 * 60 * 30, // 30 minutes ago
    commitHash: "b2b2c3d4",
    commitMessage: "Update homepage hero section",
  },
  {
    id: "a9b8c7d6-e5f4-4321-9876-543210fedcba",
    source: "github",
    status: "failed",
    timestamp: Date.now() - 1000 * 60 * 45, // 45 minutes ago
    commitHash: "d4e5f6a7",
    commitMessage: "Fix auth middleware",
  },
  {
    id: "e3eacef2-5364-448e-a329-258dfe01ecfc",
    source: "docker",
    status: "succeeded",
    timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    dockerImage: "postgres:15-alpine",
  },
  {
    id: "7c8bffe9-18d3-4c38-8615-fb725992b766",
    source: "github",
    status: "succeeded",
    timestamp: Date.now() - 1000 * 60 * 5, // 5 minutes ago
    commitHash: "98765432",
    commitMessage: "Deploy dark mode updates",
  },
  {
    id: "1fd6f8ed-912f-4c52-8cd6-c09920d3265b",
    source: "github",
    status: "succeeded",
    timestamp: Date.now() - 1000 * 60 * 15, // 15 minutes ago
    commitHash: "abcd1234",
    commitMessage: "Add metrics endpoint",
  },
  {
    id: "c7977e1f-9641-4d21-9671-a7d5e4a1d506",
    source: "docker",
    status: "failed",
    timestamp: Date.now() - 1000 * 60 * 60, // 1 hour ago
    dockerImage: "mysql:9.2.0",
  },
  {
    id: "8b3deb22-0577-4ea4-9e84-88890b9fa5a8",
    source: "github",
    status: "succeeded",
    timestamp: Date.now() - 1000 * 60 * 10, // 10 minutes ago
    commitHash: "ef012345",
    commitMessage: "Update API integration",
  },
  {
    id: "98b7edb0-9fdd-46df-9607-c2e44e31fa9c",
    source: "docker",
    status: "succeeded",
    timestamp: Date.now() - 1000 * 60 * 20, // 20 minutes ago
    dockerImage: "bitnami/clickhouse:latest",
  },
];
