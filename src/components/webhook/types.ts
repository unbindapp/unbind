export type TWebhookTeamProps = {
  type: "team";
  teamId: string;
  projectId?: never;
};

export type TWebhookProjectProps = {
  type: "project";
  teamId: string;
  projectId: string;
};

export type TWebhookProps = TWebhookTeamProps | TWebhookProjectProps;
