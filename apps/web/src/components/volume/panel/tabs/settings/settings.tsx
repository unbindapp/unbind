import TabWrapper from "@/components/navigation/tab-wrapper";
import { cn } from "@/components/ui/utils";
import ConnectionSection from "@/components/volume/panel/tabs/settings/sections/connection-section";
import DeleteSection from "@/components/volume/panel/tabs/settings/sections/delete-section";
import ExpandSection from "@/components/volume/panel/tabs/settings/sections/expand-section";
import UsageSection from "@/components/volume/panel/tabs/settings/sections/usage-section";
import { TVolumeShallow } from "@/lib/queries/services";
import { HourglassIcon } from "lucide-react";

type TProps = { volume: TVolumeShallow };

export default function Settings({ volume }: TProps) {
  return (
    <TabWrapper className="gap-6">
      {volume.is_deleting && (
        <BannerWrapper className="bg-destructive/8 border-destructive/8 text-destructive">
          <HourglassIcon className="animate-hourglass mt-0.5 -ml-0.5 size-4 shrink-0" />
          <p className="min-w-0 shrink leading-tight">
            Deleting the volume. It will disappear once the deletion is complete.
          </p>
        </BannerWrapper>
      )}
      {volume.is_attaching && (
        <BannerWrapper className="bg-process/8 border-process/8 text-process">
          <HourglassIcon className="animate-hourglass mt-0.5 -ml-0.5 size-4 shrink-0" />
          <p className="min-w-0 shrink leading-tight">Attaching the volume to the service.</p>
        </BannerWrapper>
      )}
      {volume.is_detaching && (
        <BannerWrapper className="bg-warning/8 border-warning/8 text-warning">
          <HourglassIcon className="animate-hourglass mt-0.5 -ml-0.5 size-4 shrink-0" />
          <p className="min-w-0 shrink leading-tight">
            Detaching the volume. It can be reattached once this is complete.
          </p>
        </BannerWrapper>
      )}
      <UsageSection volume={volume} />
      <ExpandSection volume={volume} />
      <ConnectionSection volume={volume} />
      <DeleteSection volume={volume} />
    </TabWrapper>
  );
}

function BannerWrapper({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <div
      className={cn(
        "flex w-full items-start justify-start gap-2 rounded-lg border px-3.5 py-2.5 md:max-w-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
