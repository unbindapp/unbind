import DeleteServiceSection from "@/components/service/panel/tabs/settings/sections/delete-service-section";
import TabWrapper from "@/components/navigation/tab-wrapper";
import { cn } from "@/components/ui/utils";
import { CodeIcon, FlameIcon, NetworkIcon, RocketIcon, WrenchIcon } from "lucide-react";
import { FC, ReactNode } from "react";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import SourceSection from "@/components/service/panel/tabs/settings/sections/source-section";
import NetworkingSection from "@/components/service/panel/tabs/settings/sections/networking-section";
import BuildSection from "@/components/service/panel/tabs/settings/sections/build-section";
import DeploySection from "@/components/service/panel/tabs/settings/sections/deploy-section";

export default function Settings({ service }: { service: TServiceShallow }) {
  return (
    <TabWrapper className="pt-4">
      <Section title="Source" id="source" Icon={CodeIcon}>
        <SourceSection service={service} />
      </Section>
      <Section className="pt-4" title="Networking" id="networking" Icon={NetworkIcon}>
        <NetworkingSection service={service} />
      </Section>
      <Section className="pt-4" title="Build" id="build" Icon={WrenchIcon}>
        <BuildSection service={service} />
      </Section>
      <Section className="pt-4" title="Deploy" id="deploy" Icon={RocketIcon}>
        <DeploySection service={service} />
      </Section>
      <Section className="pt-4" title="Delete Service" id="danger-zone" Icon={FlameIcon}>
        <DeleteServiceSection service={service} />
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
    <div className={cn("flex w-full flex-col", className)} id={id}>
      <div className="flex w-full items-center justify-start gap-2 px-1 pb-3">
        <Icon className="size-4.5 shrink-0" />
        <h3 className="min-w-0 shrink text-lg leading-tight font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
