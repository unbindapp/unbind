import TabWrapper from "@/components/navigation/tab-wrapper";
import { cn } from "@/components/ui/utils";
import DeleteSection from "@/components/volume/panel/tabs/settings/sections/delete-section";
import SizeSection from "@/components/volume/panel/tabs/settings/sections/resize-section";
import UsageSection from "@/components/volume/panel/tabs/settings/sections/usage-section";
import { TVolumeShallow } from "@/server/trpc/api/services/types";
import { ChartNoAxesColumnIcon, FlameIcon, ScalingIcon } from "lucide-react";
import { FC, ReactNode } from "react";

export default function Settings({ volume }: { volume: TVolumeShallow }) {
  return (
    <TabWrapper className="pt-4">
      <Section title="Usage" id="usage" Icon={ChartNoAxesColumnIcon}>
        <UsageSection />
      </Section>
      <Section className="pt-4" title="Resize" id="Resize" Icon={ScalingIcon}>
        <SizeSection />
      </Section>
      <Section className="pt-4" title="Delete Volume" id="danger" Icon={FlameIcon}>
        <DeleteSection volume={volume} />
      </Section>
    </TabWrapper>
  );
}

function Section({
  id,
  title,
  Icon,
  children,
  className,
}: {
  id: string;
  title: string;
  Icon: FC<{ className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div id={id} className={cn("flex w-full flex-col", className)}>
      <div className="flex w-full items-center justify-start gap-2 px-1 pb-3">
        <Icon className="size-4.5 shrink-0" />
        <h3 className="min-w-0 shrink text-lg leading-tight font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
