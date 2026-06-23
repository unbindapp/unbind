import { TDeploymentPanelTabEnum } from "@/components/deployment/panel/constants";
import TabIndicator from "@/components/navigation/tab-indicator";
import ScrollOverflowIndicator from "@/components/scroll-overflow-indicator";
import { TServicePanelTabEnum } from "@/components/service/panel/constants";
import { LinkButton } from "@/components/ui/button";
import { TVolumePanelTabEnum } from "@/components/volume/panel/constants";
import { useIntent } from "@/lib/hooks/use-intent";
import { useScrollActiveIntoView } from "@/lib/hooks/use-scroll-active-into-view";
import { useScrollOverflow } from "@/lib/hooks/use-scroll-overflow";
import { Ref, useRef } from "react";

// Each panel writes its active tab to its own search param; this maps the param
// key to the enum its value must be, so `tab.value` is type-checked per panel.
type TPanelTabValueByKey = {
  service_tab: TServicePanelTabEnum;
  deployment_tab: TDeploymentPanelTabEnum;
  volume_tab: TVolumePanelTabEnum;
};
type TPanelTabKey = keyof TPanelTabValueByKey;

type TGenericTab<T, V extends string> = T & {
  title: string;
  value: V;
  onIntent?: () => void;
};

type TProps<T, K extends TPanelTabKey> = {
  tabs: TGenericTab<T, TPanelTabValueByKey[K]>[];
  searchKey: K;
  currentTabId: TPanelTabValueByKey[K];
  layoutId: string;
};

export default function PanelNavbar<T, K extends TPanelTabKey>({
  tabs,
  searchKey,
  currentTabId,
  layoutId,
}: TProps<T, K>) {
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const { canScrollRight } = useScrollOverflow({ ref: navRef, offset: 52 });
  const { registerItem } = useScrollActiveIntoView({
    containerRef: navRef,
    activeKey: currentTabId,
    endInsetRef: indicatorRef,
  });

  return (
    <div className="relative w-full overflow-hidden">
      <nav
        ref={navRef}
        className="touch:scrollbar-hidden flex w-full justify-start overflow-auto border-b pr-6"
      >
        <div className="flex justify-start px-2 pt-2 sm:px-4.5 sm:pt-3">
          {tabs.map((tab) => (
            <PanelNavbarTab
              key={tab.value}
              ref={registerItem(tab.value)}
              tab={tab}
              searchKey={searchKey}
              isActive={tab.value === currentTabId}
              layoutId={layoutId}
            />
          ))}
        </div>
      </nav>
      <ScrollOverflowIndicator ref={indicatorRef} canScrollRight={canScrollRight} />
    </div>
  );
}

function PanelNavbarTab<T, K extends TPanelTabKey>({
  ref,
  tab,
  searchKey,
  isActive,
  layoutId,
}: {
  ref: Ref<HTMLAnchorElement>;
  tab: TGenericTab<T, TPanelTabValueByKey[K]>;
  searchKey: K;
  isActive: boolean;
  layoutId: string;
}) {
  const intentProps = useIntent({
    onIntent: () => tab.onIntent?.(),
    enabled: !!tab.onIntent,
  });

  return (
    <LinkButton
      ref={ref}
      from="/$team_id/project/$project_id"
      search={(prev) => ({ ...prev, [searchKey]: tab.value })}
      resetScroll={false}
      variant="ghost"
      data-active={isActive || undefined}
      className="group/button text-muted-foreground data-active:text-foreground min-w-0 shrink rounded-t-md rounded-b-none px-3 pt-2.5 pb-4.5 font-medium active:bg-transparent has-hover:hover:bg-transparent"
      {...intentProps}
    >
      {isActive && <TabIndicator layoutId={layoutId} />}
      <div className="pointer-events-none absolute h-full w-full py-1">
        <div className="bg-border/0 has-hover:group-hover/button:bg-border group-active/button:bg-border h-full w-full rounded-lg" />
      </div>
      <p className="relative min-w-0 shrink leading-none">{tab.title}</p>
    </LinkButton>
  );
}
