import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const mainRouter = createTRPCRouter({
  getProjects: publicProcedure.input(z.object({})).query(async function ({}) {
    return {
      projects,
    };
  }),
});

const projects: TProject[] = [
  {
    title: "Acme",
    id: "f435d289-d8a7-4aa5-8998-106953dd6f65",
    services: [
      {
        id: "04a595bb-57d5-4d39-850d-5400e0adb8c9",
        serviceType: "nextjs",
      },
      {
        id: "ad393e8a-c5ea-46f6-a650-144fd99bdc55",
        serviceType: "postgres",
      },
      {
        id: "2c93a68c-4604-4754-99b8-ffd596abd14a",
        serviceType: "redis",
      },
    ],
  },
  {
    title: "Umbrella",
    id: "cce28aef-9c51-461f-8fc3-d777ea47c69d",
    services: [
      {
        id: "db8353be-6ec6-4c9d-9a6d-79cedaf5bb9e",
        serviceType: "svelte",
      },
      {
        id: "09463e12-7e7a-45fa-913f-9200e090468a",
        serviceType: "umami",
      },
    ],
  },
  {
    title: "Hamburger",
    id: "7d836bb0-8747-469e-9032-5f061cd2e696",
    services: [
      {
        id: "f9d60dad-5184-43e3-a1bd-e1bfcd8575bb",
        serviceType: "go",
      },
      {
        id: "bd251dca-18c0-4a8b-bae9-1dfc1b00d979",
        serviceType: "mysql",
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
  | "meili";

type TService = {
  id: string;
  serviceType: TServiceType;
};

export type TProject = {
  id: string;
  title: string;
  services: TService[];
};
