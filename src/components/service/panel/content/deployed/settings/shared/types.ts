import { TServiceShallow } from "@/server/trpc/api/services/types";

export type TGitSectionContentProps = {
  owner: string;
  repo: string;
  branch: string;
  installationId: number;
  service: TServiceShallow;
};

export type TDatabaseSectionContentProps = { type: string; version: string };

export type TDockerImageSectionContentProps = {
  image: string;
  tag: string;
};
