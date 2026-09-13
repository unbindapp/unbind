import { BlockItemButtonLike } from "@/components/block";
import CopyButton from "@/components/copy-button";
import { getNetworkingDisplayUrl } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/helpers";
import { cn } from "@/components/ui/utils";
import { EthernetPortIcon, GlobeIcon, GlobeLockIcon } from "lucide-react";
import { useCallback } from "react";

type TProps = {
  mode: "public" | "private";
  domain: string;
  port?: number;
};

// A database's address is allocated rather than chosen, so there is nothing to edit
// and nothing to delete here. Public and private are switched with the toggle above.
export default function DatabaseEndpointCard({ mode, domain, port }: TProps) {
  const address = getNetworkingDisplayUrl({ host: domain, port: port?.toString() ?? "" });

  const SuffixComponent = useCallback(
    ({ className }: { className?: string }) => (
      <div className={cn("-my-2.5 -mr-3 flex items-start justify-end self-stretch p-1", className)}>
        <CopyButton className="size-8" classNameIcon="size-4" valueToCopy={address} />
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
            <GlobeLockIcon className={cn(className, "size-4.5")} />
          ) : (
            <GlobeIcon className={cn(className, "size-4.5")} />
          )
        }
        SuffixComponent={SuffixComponent}
      />
    </div>
  );
}

export function DatabasePrivateRow() {
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-lg border">
      <BlockItemButtonLike
        asElement="div"
        className="text-muted-foreground border-none"
        text="Private database"
        Icon={({ className }: { className?: string }) => (
          <EthernetPortIcon className={cn(className, "size-4.5")} />
        )}
      />
    </div>
  );
}
