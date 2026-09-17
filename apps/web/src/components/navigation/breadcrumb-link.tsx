import { LinkButton, TLinkButtonProps } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

type TProps = {
  to: TLinkButtonProps["to"];
  children: string;
  className?: string;
};

export function BreadcrumbLink({ to, children, className }: TProps) {
  return (
    <LinkButton
      to={to}
      variant="ghost"
      size="sm"
      forceMinSize={false}
      className={cn(
        "group/button relative flex max-w-44 min-w-0 shrink items-center justify-start rounded border-none px-2.75 py-3.5 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-transparent has-hover:hover:bg-transparent",
        className,
      )}
    >
      <div className="pointer-events-none absolute top-0 left-0 h-full w-full py-1.5">
        <div className="bg-border/0 has-hover:group-hover/button:bg-border group-active/button:bg-border group-focus-visible/button:ring-primary/8-10 h-full w-full rounded-lg group-focus-visible/button:ring-1" />
      </div>
      <p className="relative min-w-0 shrink truncate py-0.5 leading-none">{children}</p>
    </LinkButton>
  );
}
