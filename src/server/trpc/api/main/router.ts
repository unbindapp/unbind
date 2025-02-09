import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
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
      })
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
        projectId: z.string(),
        environmentId: z.string(),
      })
    )
    .query(async function ({ input: { projectId, environmentId } }) {
      const project = projects.find((p) => p.id === projectId);
      if (!project) {
        throw new Error("Project not found");
      }
      const environment = project.environments.find(
        (e) => e.id === environmentId
      );
      if (!environment) {
        throw new Error("Environment not found");
      }
      return {
        services: environment.services,
      };
    }),
});

async function getProjects({ teamId }: { teamId: string }) {
  return projects.filter((p) => p.teamId === teamId);
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
            type: "nextjs",
            title: "Web App",
            lastDeployment: {
              id: "513628d7-7b2c-4174-b2b2-09ba8dbe6189",
              source: "github",
              status: "success",
              timestamp: Date.now(),
            },
          },
          {
            id: "ad393e8a-c5ea-46f6-a650-144fd99bdc55",
            type: "postgres",
            title: "Database",
            lastDeployment: {
              id: "e3eacef2-5364-448e-a329-258dfe01ecfc",
              source: "docker",
              status: "success",
              timestamp: Date.now() - 1000 * 60 * 60 * 24,
            },
          },
          {
            id: "2c93a68c-4604-4754-99b8-ffd596abd14a",
            type: "redis",
            title: "Cache",
            lastDeployment: {
              id: "22c3852d-b4d2-498c-afe6-32b9e4f95ec7",
              source: "docker",
              status: "success",
              timestamp: Date.now() - 1000 * 60 * 60 * 24 * 14,
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
            type: "svelte",
            title: "Website",
            lastDeployment: {
              id: "7c8bffe9-18d3-4c38-8615-fb725992b766",
              source: "github",
              status: "success",
              timestamp: Date.now() - 1000 * 60 * 60 * 1,
            },
          },
          {
            id: "d5e2ee62-f30a-4b4f-9070-4f658e17b7ed",
            type: "astro",
            title: "Docs",
            lastDeployment: {
              id: "c8f17ad4-1989-4fde-9b0f-3ec4384d1686",
              source: "github",
              status: "success",
              timestamp: Date.now() - 1000 * 60 * 60 * 5,
            },
          },
          {
            id: "09463e12-7e7a-45fa-913f-9200e090468a",
            type: "nextjs",
            title: "Umami Frontend",
            serviceGroup: {
              id: "10f5aeb7-59d1-495a-92fd-3a245566ee55",
              title: "Umami",
              type: "umami",
            },
            lastDeployment: {
              id: "14cdeb8e-5bca-44e6-9385-c4e29a809f49",
              source: "docker",
              status: "success",
              timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2,
            },
          },
          {
            id: "5d6eed80-ed5e-4d67-944f-aa6d726f0ab3",
            type: "postgres",
            title: "Umami Database",
            serviceGroup: {
              id: "10f5aeb7-59d1-495a-92fd-3a245566ee55",
              title: "Umami",
              type: "umami",
            },
            lastDeployment: {
              id: "5725486e-696a-4202-9f19-89dc17275352",
              source: "docker",
              status: "success",
              timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2,
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
            type: "go",
            title: "API",
            lastDeployment: {
              id: "1fd6f8ed-912f-4c52-8cd6-c09920d3265b",
              source: "github",
              status: "success",
              timestamp: Date.now() - 1000 * 60 * 60 * 0.5,
            },
          },
          {
            id: "bd251dca-18c0-4a8b-bae9-1dfc1b00d979",
            type: "mysql",
            title: "DB",
            lastDeployment: {
              id: "c7977e1f-9641-4d21-9671-a7d5e4a1d506",
              source: "docker",
              status: "success",
              timestamp: Date.now() - 1000 * 60 * 60 * 24 * 64,
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
];

export type TServiceType =
  | "nextjs"
  | "svelte"
  | "umami"
  | "postgres"
  | "redis"
  | "clickhouse"
  | "go"
  | "rust"
  | "mysql"
  | "minio"
  | "meili"
  | "astro";

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
  title: string;
  lastDeployment?: TDeployment;
  type: TServiceType;
  serviceGroup?: TServiceGroup;
};

export type TServiceGroup = {
  id: string;
  title: string;
  type: TServiceType;
};

export type TDeploymentSource = "github" | "docker";

export type TDeployment = {
  id: string;
  source: TDeploymentSource;
  status: "pending" | "success" | "failure";
  timestamp: number;
};

export type TProject = {
  id: string;
  title: string;
  teamId: string;
  environments: TEnvironment[];
};
