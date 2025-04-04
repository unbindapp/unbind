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
  id?: string;
  title: string;
  titleSuffix?: string;
  Icon: FC<{ className?: string }>;
  subpage?: TCommandPanelPage;
  onSelect?: (props: { isPendingId: string | null }) => void;
  keywords: string[];
};

export type TContextAwareCommandPanelContext =
  | {
      contextType: "team";
      teamId: string;
      projectId?: never;
    }
  | {
      contextType: "project";
      teamId: string;
      projectId: string;
    }
  | {
      contextType: "new-service";
      teamId: string;
      projectId: string;
    }
  | {
      contextType: "new-project";
      teamId: string;
      projectId?: never;
    };
