import { FC } from "react";

type TGetItemsAsyncFunction = (params: {
  teamId: string;
  projectId: string;
  search?: string;
}) => Promise<TCommandPanelItem[]>;

type TGetItemsFunction = (params: {
  teamId: string;
  projectId: string;
  search?: string;
}) => TCommandPanelItem[];

export type TCommandPanelPage = {
  title: string;
  id: string;
  parentPageId: string | null;
  inputPlaceholder: string;
  InputIcon?: FC<{ className?: string }>;
  itemsPinned?: TCommandPanelItem[];
  commandEmptyText?: string;
  disableCommandFilter?: boolean;
  setSearchDebounceMs?: number;
  ExplanationCard?: FC<{ className?: string }>;
} & (
  | { items: TCommandPanelItem[]; getItemsAsync?: never; getItems?: never; usesSearchAsync?: never }
  | {
      items?: never;
      getItemsAsync: TGetItemsAsyncFunction;
      getItems?: never;
      usesSearchAsync?: boolean;
    }
  | {
      items?: never;
      getItemsAsync?: never;
      getItems: TGetItemsFunction;
      usesSearchAsync?: never;
    }
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
