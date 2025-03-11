import { FC } from "react";

export type TCommandPanelPage = {
  title: string;
  id: string;
  parentPageId: string | null;
  inputPlaceholder: string;
} & (
  | { items: TCommandPanelItem[]; getItems?: never }
  | {
      getItems: ({
        teamId,
        projectId,
      }: {
        teamId: string;
        projectId: string;
      }) => Promise<TCommandPanelItem[]>;
      items?: never;
    }
);

export type TCommandPanelItem = {
  title: string;
  Icon: FC<{ className?: string }>;
  subpage?: TCommandPanelPage;
  onSelect?: () => void;
  keywords: string[];
};

export type TContextAwareCommandPanelContext =
  | {
      teamId: string;
      projectId?: never;
      environmentId?: never;
      contextType: "team";
    }
  | {
      teamId: string;
      projectId: string;
      environmentId: string;
      contextType: "project";
    };
