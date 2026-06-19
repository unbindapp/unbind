import TabIndicator from "@/components/navigation/tab-indicator";
import { Button } from "@/components/ui/button";
import { useIntent } from "@/lib/hooks/use-intent";

type TProps<T, V extends string> = {
  tabs: TGenericTab<T, V>[];
  onTabClick: (value: V) => void;
  currentTabId: string;
  layoutId: string;
};

type TGenericTab<T, V extends string> = T & {
  title: string;
  value: V;
  onIntent?: () => void;
};

export default function PanelNavbar<T, V extends string>({
  tabs,
  onTabClick,
  currentTabId,
  layoutId,
}: TProps<T, V>) {
  return (
    <nav className="touch:scrollbar-hidden flex w-full justify-start overflow-auto border-b">
      <div className="flex justify-start px-2 pt-2 sm:px-4.5 sm:pt-3">
        {tabs.map((tab) => (
          <PanelNavbarTab
            key={tab.value}
            tab={tab}
            isActive={tab.value === currentTabId}
            onTabClick={onTabClick}
            layoutId={layoutId}
          />
        ))}
      </div>
    </nav>
  );
}

function PanelNavbarTab<T, V extends string>({
  tab,
  isActive,
  onTabClick,
  layoutId,
}: {
  tab: TGenericTab<T, V>;
  isActive: boolean;
  onTabClick: (value: V) => void;
  layoutId: string;
}) {
  const intentProps = useIntent({
    onIntent: () => tab.onIntent?.(),
    enabled: !!tab.onIntent,
  });

  return (
    <Button
      variant="ghost"
      onClick={() => onTabClick(tab.value)}
      data-active={isActive || undefined}
      className="group/button text-muted-foreground data-active:text-foreground min-w-0 shrink rounded-t-md rounded-b-none px-3 pt-2.5 pb-4.5 font-medium active:bg-transparent has-hover:hover:bg-transparent"
      {...intentProps}
    >
      {isActive && <TabIndicator layoutId={layoutId} />}
      <div className="pointer-events-none absolute h-full w-full py-1">
        <div className="bg-border/0 has-hover:group-hover/button:bg-border group-active/button:bg-border h-full w-full rounded-lg" />
      </div>
      <p className="relative min-w-0 shrink leading-none">{tab.title}</p>
    </Button>
  );
}
