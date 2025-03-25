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
      teamId: string;
      projectId?: never;
      contextType: "team";
    }
  | {
      teamId: string;
      projectId: string;
      contextType: "project";
    };
