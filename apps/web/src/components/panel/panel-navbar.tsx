import TabIndicator from "@/components/navigation/tab-indicator";
import { Button } from "@/components/ui/button";
import { useIntent } from "@/lib/hooks/use-intent";
import { useScrollOverflow } from "@/lib/hooks/use-scroll-overflow";
import { ChevronRight } from "lucide-react";
import { useRef } from "react";

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
  const navRef = useRef<HTMLElement>(null);
  const { canScrollRight } = useScrollOverflow({ ref: navRef, offset: 32 });

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
              tab={tab}
              isActive={tab.value === currentTabId}
              onTabClick={onTabClick}
              layoutId={layoutId}
            />
          ))}
        </div>
      </nav>
      <div
        data-visible={canScrollRight || undefined}
        className="from-background via-background to-background/0 pointer-events-none absolute top-0 right-0 flex h-[calc(100%-1px)] translate-x-full flex-col items-center justify-center bg-linear-to-l pr-1.5 pl-10 opacity-0 transition data-visible:translate-x-0 data-visible:opacity-100"
      >
        <ChevronRight className="text-muted-more-foreground size-5" />
      </div>
    </div>
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
