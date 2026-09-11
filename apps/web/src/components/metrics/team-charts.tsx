"use client";

import MetricsChartList from "@/components/metrics/metrics-chart-list";
import { useProjects } from "@/components/project/projects-provider";
import { useMemo } from "react";

export default function TeamCharts() {
  const { data: projectsData, error: projectsError, isPending: projectsIsPending } = useProjects();

  const tooltipNameFormatter: ((name: string) => string) | undefined = useMemo(() => {
    if (!projectsData) return undefined;
    return (name: string) =>
      projectsData.projects.find((project) => project.id === name)?.name || name;
  }, [projectsData]);

  return (
    <MetricsChartList
      tooltipNameFormatter={tooltipNameFormatter}
      tooltipNameFormatterError={!tooltipNameFormatter ? projectsError?.message : undefined}
      tooltipNameFormatterIsPending={!tooltipNameFormatter ? projectsIsPending : false}
    />
  );
}
