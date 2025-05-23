import TabIndicator from "@/components/navigation/tab-indicator";
import { Button } from "@/components/ui/button";

type TProps<T, V extends string> = {
  tabs: TGenericTab<T, V>[];
  onTabClick: (value: V) => void;
  currentTabId: string;
  layoutId: string;
};

type TGenericTab<T, V extends string> = T & {
  title: string;
  value: V;
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
          <Button
            key={tab.value}
            variant="ghost"
            onClick={() => onTabClick(tab.value)}
            data-active={tab.value === currentTabId ? true : undefined}
            className="group/button text-muted-foreground data-active:text-foreground min-w-0 shrink rounded-t-md rounded-b-none px-3 pt-2.5 pb-4.5 font-medium active:bg-transparent has-hover:hover:bg-transparent"
          >
            {tab.value === currentTabId && <TabIndicator layoutId={layoutId} />}
            <div className="pointer-events-none absolute h-full w-full py-1">
              <div className="bg-border/0 has-hover:group-hover/button:bg-border group-active/button:bg-border h-full w-full rounded-lg" />
            </div>
            <p className="relative min-w-0 shrink leading-none">{tab.title}</p>
          </Button>
        ))}
      </div>
    </nav>
  );
}
