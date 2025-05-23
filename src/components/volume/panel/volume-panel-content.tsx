import PanelContentWrapper from "@/components/panel/panel-content-wrapper";
import PanelNavbar from "@/components/panel/panel-navbar";
import PanelTabWrapper from "@/components/panel/panel-tab-wrapper";
import { TVolumePanelTabEnum } from "@/components/volume/panel/constants";
import Settings from "@/components/volume/panel/tabs/settings/settings";
import { useVolumePanel } from "@/components/volume/panel/volume-panel-provider";
import { TVolumeShallow } from "@/server/trpc/api/services/types";
import { FC, HTMLAttributes, ReactNode } from "react";

type TProps = {
  volume: TVolumeShallow;
  teamId: string;
  projectId: string;
  environmentId: string;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

type TVolumePage = FC<{ volume: TVolumeShallow }>;
type TVolumePageProvider = FC<TVolumePageProviderProps>;
type TVolumePageProviderProps = {
  children: ReactNode;
} & TVolumeProps;

export type TVolumePanelTab = {
  title: string;
  value: TVolumePanelTabEnum;
  Page: TVolumePage;
  Provider: TVolumePageProvider;
  noScrollArea?: boolean;
};

type TVolumeProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
  volume: TVolumeShallow;
};

const EmptyProvider = ({ children }: TVolumePageProviderProps) => children;

const tabs: TVolumePanelTab[] = [
  { title: "Settings", value: "settings", Page: Settings, Provider: EmptyProvider },
];

export default function VolumePanelContent({
  volume,
  teamId,
  projectId,
  environmentId,
  className,
  ...rest
}: TProps) {
  const { currentTabId, setCurrentTabId } = useVolumePanel();
  const currentTab = tabs.find((tab) => tab.value === currentTabId);

  return (
    <PanelContentWrapper className={className} {...rest}>
      <PanelNavbar
        tabs={tabs}
        currentTabId={currentTabId}
        onTabClick={(value) => setCurrentTabId(value)}
        layoutId="volume-panel-tab"
      />
      <PanelTabWrapper noScrollArea={currentTab?.noScrollArea}>
        {currentTab && (
          <currentTab.Provider
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
            volume={volume}
          >
            <currentTab.Page volume={volume} />
          </currentTab.Provider>
        )}
      </PanelTabWrapper>
    </PanelContentWrapper>
  );
}
