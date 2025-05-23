import TabWrapper from "@/components/navigation/tab-wrapper";
import { cn } from "@/components/ui/utils";
import { TVolumeShallow } from "@/server/trpc/api/services/types";
import { CodeIcon } from "lucide-react";
import { FC, ReactNode } from "react";

export default function Settings({ volume }: { volume: TVolumeShallow }) {
  return (
    <TabWrapper className="pt-4">
      <Section title="Source" id="source" Icon={CodeIcon}>
        {volume.id} Settings
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
