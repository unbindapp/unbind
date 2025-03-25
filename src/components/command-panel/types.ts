import { FC } from "react";

export type TCommandPanelPage = {
  title: string;
  id: string;
  parentPageId: string | null;
  inputPlaceholder: string;
} & (
  | { items: TCommandPanelItem[]; getItems?: never; IconSet?: never }
  | {
      getItems: ({
        teamId,
        projectId,
      }: {
        teamId: string;
        projectId: string;
      }) => Promise<TCommandPanelItem[]>;
      IconSet: FC<{ id: string; className?: string }>;
      items?: never;
    }
);

export type TCommandPanelItem = {
  title: string;
  titleSuffix?: string;
  Icon?: FC<{ className?: string }>;
  subpage?: TCommandPanelPage;
  onSelect?: () => void;
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
