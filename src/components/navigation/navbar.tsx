import Logo from "@/components/icons/logo";
import { Button, LinkButton } from "@/components/ui/button";

type Props = {};

export default function Navbar({}: Props) {
  return (
    <nav className="w-full sticky top-0 left-0 flex flex-row items-center justify-between px-3 py-1.5">
      <div className="shrink min-w-0 flex items-center justify-start">
        <LinkButton
          size="icon"
          className="size-9 rounded-lg"
          variant="ghost"
          href="/"
        >
          <Logo className="size-6" />
        </LinkButton>
      </div>
      {/* Avatar */}
      <div className="shrink min-w-0 flex items-center justify-end">
        <Button size="icon" className="size-6 rounded-full" variant="ghost">
          <div className="size-full rounded-full bg-foreground/50" />
        </Button>
      </div>
    </nav>
  );
}
