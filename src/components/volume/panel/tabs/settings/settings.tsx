import TabWrapper from "@/components/navigation/tab-wrapper";
import ConnectionSection from "@/components/volume/panel/tabs/settings/sections/connection-section";
import DeleteSection from "@/components/volume/panel/tabs/settings/sections/delete-section";
import ExpandSection from "@/components/volume/panel/tabs/settings/sections/expand-section";
import UsageSection from "@/components/volume/panel/tabs/settings/sections/usage-section";
import { TVolumeShallow } from "@/server/trpc/api/services/types";

type TProps = { volume: TVolumeShallow };

export default function Settings({ volume }: TProps) {
  return (
    <TabWrapper className="gap-6">
      <UsageSection volume={volume} />
      <ExpandSection volume={volume} />
      <ConnectionSection volume={volume} />
      <DeleteSection volume={volume} />
    </TabWrapper>
  );
}
