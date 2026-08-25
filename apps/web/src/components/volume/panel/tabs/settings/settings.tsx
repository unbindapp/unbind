import TabWrapper from "@/components/navigation/tab-wrapper";
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
      {/* Kubernetes removes the volume asynchronously after a delete, so it
      can linger in a terminating state for a while — the sections below stay
      visible but their controls are disabled. */}
      {volume.is_deleting && (
        <div className="bg-destructive/8 border-destructive/8 text-destructive flex w-full items-start justify-start gap-2 rounded-lg border px-3.5 py-2.5 font-medium">
          <HourglassIcon className="animate-hourglass mt-0.5 -ml-0.5 size-4 shrink-0" />
          <p className="min-w-0 shrink leading-tight">
            Deleting the volume. It will disappear from the list once the deletion is complete.
          </p>
        </div>
      )}
      <UsageSection volume={volume} />
      <ExpandSection volume={volume} />
      <ConnectionSection volume={volume} />
      <DeleteSection volume={volume} />
    </TabWrapper>
  );
}
