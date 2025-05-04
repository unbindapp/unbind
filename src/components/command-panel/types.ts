import { FC } from "react";

type TGetItemsFunction = (params: {
  teamId: string;
  projectId: string;
  search?: string;
}) => Promise<TCommandPanelItem[]>;

export type TCommandPanelPage = {
  title: string;
  id: string;
  parentPageId: string | null;
  inputPlaceholder: string;
  InputIcon?: FC<{ className?: string }>;
  itemsPinned?: TCommandPanelItem[];
  commandEmptyText?: string;
  disableSearch?: boolean;
} & (
  | { items: TCommandPanelItem[]; getItems?: never; usesAsyncSearch?: never }
  | {
      items?: never;
      getItems: TGetItemsFunction;
      usesAsyncSearch?: never;
    }
  | { usesAsyncSearch: boolean; getItems: TGetItemsFunction; items?: never }
);

export type TCommandPanelItem = {
  id: string;
  title: string;
  titleSuffix?: string;
  Icon: FC<{ className?: string }>;
  ChipComponent?: FC<{ className?: string }>;
  subpage?: TCommandPanelPage;
  onSelect?: (props: {
    isPendingId: string | null;
    setCurrentPageId: (id: string) => void;
  }) => void;
  onHighlight?: () => void;
  keywords: string[];
  disabled?: boolean;
};

export type TContextCommandPanelContext =
  | {
      contextType: "team";
      teamId: string;
      projectId?: never;
    }
  | {
      contextType: "new-project";
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
    };
