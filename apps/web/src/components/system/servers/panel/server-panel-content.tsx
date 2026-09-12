import PanelContentWrapper from "@/components/panel/panel-content-wrapper";
import PanelNavbar from "@/components/panel/panel-navbar";
import PanelTabWrapper from "@/components/panel/panel-tab-wrapper";
import {
  serverPanelTabKey,
  TServerPanelTabEnum,
} from "@/components/system/servers/panel/constants";
import { useServerPanel } from "@/components/system/servers/panel/server-panel-provider";
import Details from "@/components/system/servers/panel/tabs/details/details";
import Metrics from "@/components/system/servers/panel/tabs/metrics/metrics";
import { TServer } from "@/lib/queries/servers";
import { FC, HTMLAttributes } from "react";

type TProps = {
  server: TServer;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

export type TServerPanelTab = {
  title: string;
  value: TServerPanelTabEnum;
  Page: FC<{ server: TServer }>;
};

const tabs: TServerPanelTab[] = [
  { title: "Details", value: "details", Page: Details },
  { title: "Metrics", value: "metrics", Page: Metrics },
];

export default function ServerPanelContent({ server, className, ...rest }: TProps) {
  const { currentTabId } = useServerPanel();
  const currentTab = tabs.find((tab) => tab.value === currentTabId);

  return (
    <PanelContentWrapper className={className} {...rest}>
      <PanelNavbar
        tabs={tabs}
        from="/system"
        searchKey={serverPanelTabKey}
        currentTabId={currentTabId}
        layoutId="server-panel-tab"
      />
      <PanelTabWrapper key={currentTab?.value}>
        {currentTab && <currentTab.Page server={server} />}
      </PanelTabWrapper>
    </PanelContentWrapper>
  );
}
