import DeleteServiceSection from "@/components/service/tabs/settings/delete-service-section";
import TabWrapper from "@/components/service/tabs/tab-wrapper";
import { cn } from "@/components/ui/utils";
import { FlameIcon } from "lucide-react";
import { FC, ReactNode } from "react";

export default function Settings() {
  return (
    <TabWrapper>
      <Section title="Delete Service" id="danger-zone" Icon={FlameIcon}>
        <DeleteServiceSection />
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
      <div className="flex w-full items-center justify-start gap-1.5 px-2 pb-3">
        <Icon className="size-4.5 shrink-0" />
        <h3 className="min-w-0 shrink text-lg leading-tight font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
