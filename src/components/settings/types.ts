import { TServiceShallow } from "@/server/trpc/api/services/types";

export type TGitSectionProps = {
  owner: string;
  repo: string;
  branch: string;
  installationId: number;
  service: TServiceShallow;
};

export type TDatabaseSectionProps = { type: string; version: string };

export type TDockerImageSectionProps = {
  image: string;
  tag: string;
};
