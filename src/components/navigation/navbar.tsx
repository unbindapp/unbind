import Blockies from "@/components/blockies/blockies";
import Logo from "@/components/icons/logo";
import Breadcrumb from "@/components/navigation/breadcrumb";
import { Button, LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

type Props = {
  className?: string;
};

export default async function Navbar({ className }: Props) {
  return (
    <nav
      className={cn(
        "w-full sticky top-0 left-0 z-50 bg-background border-b flex flex-row items-center justify-between px-3 py-1.5",
        className
      )}
    >
      <div className="shrink min-w-0 flex items-center justify-start -ml-0.5">
        <LinkButton
          size="icon"
          className="size-9 rounded-lg"
          variant="ghost"
          href="/"
        >
          <Logo className="size-6" />
        </LinkButton>
        <Breadcrumb />
      </div>
      {/* Avatar */}
      <div className="shrink min-w-0 flex items-center justify-end">
        <Button
          size="icon"
          className="size-6.5 rounded-full border border-foreground group/button"
          variant="ghost"
        >
          <Blockies
            address="yekta"
            className="size-full rounded-full transition group-hover/button:rotate-30 group-active/button:rotate-30"
          />
        </Button>
      </div>
    </nav>
  );
}
