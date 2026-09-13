import Banner from "@/components/banner";
import { formatCores, formatMegabytes } from "@/components/system/servers/format";
import { getTemplateHeadroom } from "@/components/templates/resource-headroom";
import { TTemplateWithDefinition } from "@/components/templates/template-draft-store";
import { serversListQuery } from "@/lib/queries/servers";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  CpuIcon,
  MemoryStickIcon,
  TriangleAlertIcon,
} from "lucide-react";

type TProps = {
  template: TTemplateWithDefinition;
};

export default function TemplateHeadroomBanner({ template }: TProps) {
  const { data } = useQuery(serversListQuery());
  if (!data) return null;

  const headroom = getTemplateHeadroom(data.data, template.resource_recommendations);
  if (headroom.level === "normal") return null;

  return (
    <div className="w-full px-1 pb-6 lg:w-1/2">
      <Banner
        data-level={headroom.level}
        className="group/banner data-[level=destructive]:border-destructive/7-10 data-[level=warning]:border-warning/7-10 border md:max-w-full"
      >
        <div className="text-foreground group-data-[level=destructive]/banner:text-destructive group-data-[level=warning]/banner:text-warning line-icon -ml-0.5">
          {headroom.level === "destructive" ? (
            <TriangleAlertIcon className="size-4" />
          ) : headroom.level === "warning" ? (
            <CircleAlertIcon className="size-4" />
          ) : (
            <CheckCircle2Icon className="size-4" />
          )}
        </div>
        <div className="flex min-w-0 shrink flex-col gap-2">
          <p className="group-data-[level=destructive]/banner:text-destructive group-data-[level=warning]/banner:text-warning font-semibold">
            {headroom.level === "destructive"
              ? "Deploying the template may overload Unbind."
              : headroom.level === "warning"
                ? "Deploying the template may degrade performance."
                : "The template can be deployed safely."}
          </p>
          <div className="flex w-full flex-col gap-0.5">
            <ResourceLine
              label="Minimum Recommended:"
              cpuMillicores={headroom.recommendedCpuMillicores}
              memoryMegabytes={headroom.recommendedMemoryMegabytes}
            />
            <ResourceLine
              label="Available:"
              cpuMillicores={headroom.availableCpuMillicores}
              memoryMegabytes={headroom.availableMemoryMegabytes}
            />
          </div>
        </div>
      </Banner>
    </div>
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
    <p className="text-sm font-semibold">
      <span className="text-muted-foreground pr-[0.6ch] font-normal">{label}</span>
      <span className="inline-icon mr-[0.4ch]">
        <CpuIcon className="size-4" />
      </span>
      <span>{formatCores(cpuMillicores)}</span>
      <span className="text-muted-most-foreground px-[0.5ch]">{"•"}</span>
      <span className="inline-icon mr-[0.4ch]">
        <MemoryStickIcon className="size-4" />
      </span>
      <span>{formatMegabytes(memoryMegabytes)}</span>
    </p>
  );
}
