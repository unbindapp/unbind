import { BlockItemButtonLike } from "@/components/block";
import CopyButton from "@/components/copy-button";
import { getNetworkingDisplayUrl } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/helpers";
import { cn } from "@/components/ui/utils";
import { GlobeIcon, GlobeLockIcon, HourglassIcon } from "lucide-react";
import { useCallback } from "react";

type TProps = {
  mode: "public" | "private";
  domain: string;
  port?: number;
};

// A database's address is allocated rather than chosen, so there is nothing to edit
// and nothing to delete here. Public and private are switched in Network Access above.
export default function DatabaseEndpointCard({ mode, domain, port }: TProps) {
  const address = getNetworkingDisplayUrl({ host: domain, port: port?.toString() ?? "" });

  const SuffixComponent = useCallback(
    ({ className }: { className?: string }) => (
      <div
        className={cn("-my-2.5 -mr-3 flex items-start justify-end self-stretch p-0.5", className)}
      >
        <CopyButton classNameIcon="size-4" valueToCopy={address} />
      </div>
    ),
    [address],
  );

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-lg border">
      <BlockItemButtonLike
        asElement="div"
        classNameText="whitespace-normal"
        className="border-none"
        text={address}
        Icon={({ className }: { className?: string }) =>
          mode === "private" ? (
            <GlobeLockIcon className={className} />
          ) : (
            <GlobeIcon className={className} />
          )
        }
        SuffixComponent={SuffixComponent}
      />
    </div>
  );
}

// The address is allocated while the change is applied, so there is nothing to show
// until then. An empty block here is what made this section confusing.
// The hourglass only turns while something is actually being waited on: a staged
// change is waiting on the user, not on us.
export function DatabasePendingEndpointRow({ isWaiting }: { isWaiting: boolean }) {
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-lg border">
      <BlockItemButtonLike
        asElement="div"
        className="text-muted-foreground border-none"
        text="Public address will show up here"
        Icon={({ className }: { className?: string }) => (
          <HourglassIcon className={cn(className, isWaiting && "animate-hourglass", "size-4.5")} />
        )}
      />
    </div>
  );
}
