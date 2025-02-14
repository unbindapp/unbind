import { FC } from "react";

export type TCommandPanelPage = {
  id: string;
  parentPageId: string | null;
} & (
  | { items: TCommandPanelItems; getItems?: never }
  | {
      getItems: () => Promise<TCommandPanelItem[]>;
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
