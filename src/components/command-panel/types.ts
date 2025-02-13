import { FC } from "react";

export type TCommandPanelPage = {
  id: string;
  items: TCommandPanelItem[];
  parentPageId: string | null;
};

export type TCommandPanelItem = {
  title: string;
  Icon: FC<{ className?: string }>;
  subpage?: TCommandPanelPage;
  onSelect?: () => void;
  keywords: string[];
};
