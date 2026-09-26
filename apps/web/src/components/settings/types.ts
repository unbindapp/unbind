import { TServiceShallow } from "@/lib/queries/services";

export type TGitSectionProps = {
  owner: string;
  repo: string;
  branch: string;
  // Missing once the GitHub connection the service used was removed
  installationId?: number;
  service: TServiceShallow;
};

export type TDatabaseSectionProps = { type: string; version: string; service: TServiceShallow };

export type TDockerImageSectionProps = {
  image: string;
  tag: string;
  service: TServiceShallow;
};
