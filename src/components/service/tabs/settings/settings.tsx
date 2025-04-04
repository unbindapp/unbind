import DangerZoneSection from "@/components/service/tabs/settings/danger-zone-section";
import TabWrapper from "@/components/service/tabs/tab-wrapper";
import { TriangleAlertIcon } from "lucide-react";
import { FC, ReactNode } from "react";

export default function Settings() {
  return (
    <TabWrapper>
      <Section title="Danger Zone" id="danger-zone" Icon={TriangleAlertIcon}>
        <DangerZoneSection />
      </Section>
    </TabWrapper>
  );
}

function Section({
  id,
  title,
  Icon,
  children,
}: {
  id: string;
  title: string;
  Icon: FC<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col" id={id}>
      <div className="flex w-full items-center justify-start gap-2 px-2 pb-3">
        <Icon className="size-4.5" />
        <h3 className="min-w-0 shrink text-lg leading-tight font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
