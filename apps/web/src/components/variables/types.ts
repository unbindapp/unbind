import type { TServiceShallow } from "@/lib/queries/services";

export type TTeamVariableTypeProps = {
  type: "team";
  teamId: string;
  projectId?: never;
  environmentId?: never;
  serviceId?: never;
  service?: never;
};

export type TProjectVariableTypeProps = {
  type: "project";
  teamId: string;
  projectId: string;
  environmentId?: never;
  serviceId?: never;
  service?: never;
};

export type TServiceVariableTypeProps = {
  type: "service";
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  service: TServiceShallow;
};

export type TEntityVariableTypeProps =
  | TTeamVariableTypeProps
  | TProjectVariableTypeProps
  | TServiceVariableTypeProps;
