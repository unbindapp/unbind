import Banner from "@/components/banner";
import { formatCores, formatMegabytes } from "@/components/system/servers/format";
import { getTemplateHeadroom } from "@/components/templates/resource-headroom";
import { TTemplateWithDefinition } from "@/components/templates/template-draft-store";
import { serversListQuery } from "@/lib/queries/servers";
import { useQuery } from "@tanstack/react-query";
import { CpuIcon, MemoryStickIcon, TriangleAlertIcon } from "lucide-react";

type TProps = {
  template: TTemplateWithDefinition;
};

export default function TemplateHeadroomBanner({ template }: TProps) {
  const { data } = useQuery(serversListQuery());
  if (!data) return null;

  const headroom = getTemplateHeadroom(data.data, template.resource_recommendations);
  if (!headroom) return null;

  return (
    <Banner
      data-level={headroom.level}
      className="bg-warning/3-10 border-warning/3-10 text-warning data-[level=destructive]:bg-destructive/3-10 data-[level=destructive]:border-destructive/3-10 data-[level=destructive]:text-destructive"
    >
      <TriangleAlertIcon className="mt-0.5 -ml-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 shrink flex-col gap-1 leading-tight">
        <p className="font-semibold">
          {headroom.level === "destructive"
            ? "Deploying the template may overload Unbind."
            : "Deploying the template may degrade performance."}
        </p>
        <ResourceLine
          label="Min. Recommended:"
          cpuMillicores={headroom.recommendedCpuMillicores}
          memoryMegabytes={headroom.recommendedMemoryMegabytes}
        />
        <ResourceLine
          label="Available:"
          cpuMillicores={headroom.availableCpuMillicores}
          memoryMegabytes={headroom.availableMemoryMegabytes}
        />
      </div>
    </Banner>
  );
}

function ResourceLine({
  label,
  cpuMillicores,
  memoryMegabytes,
}: {
  label: string;
  cpuMillicores: number;
  memoryMegabytes: number;
}) {
  return (
    <p className="text-sm font-medium">
      <span className="pr-[0.6ch]">{label}</span>
      <CpuIcon className="mr-[0.4ch] mb-0.5 inline-block size-4" />
      <span>{formatCores(cpuMillicores)}</span>
      <span className="px-[0.5ch] opacity-50">{"•"}</span>
      <MemoryStickIcon className="mr-[0.4ch] mb-0.5 inline-block size-4" />
      <span>{formatMegabytes(memoryMegabytes)}</span>
    </p>
  );
}
