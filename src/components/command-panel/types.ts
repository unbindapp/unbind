import { FC } from "react";

export type TCommandPanelPage = {
  id: string;
  parentPageId: string | null;
  isAsync?: boolean;
} & (
  | { items: TCommandPanelItems; itemsQuery: () => null }
  | {
      itemsQuery: () => {
        data: TCommandPanelItem[] | undefined;
        isPending?: boolean;
        isError?: boolean;
      };
      items?: never;
    }
);

export type TCommandPanelItems = TCommandPanelItem[];

export type TCommandPanelItem = {
  title: string;
  Icon: FC<{ className?: string }>;
  subpage?: TCommandPanelPage;
  onSelect?: () => void;
  keywords: string[];
};
