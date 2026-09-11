export const metricsViews = ["individual", "aggregate"] as const;
export type TMetricsView = (typeof metricsViews)[number];

export const aggregateDataKey = "total";

export type TMetricDetail = { timestamp: string; breakdown: Record<string, number | null> };
export type TMetricRow = { timestamp: string } & Record<string, string | number | null>;

/** Empty `selectedIds` means every id; ids missing from the breakdown are ignored. */
export function shapeMetricSeries(
  details: TMetricDetail[],
  view: TMetricsView,
  selectedIds: string[],
): TMetricRow[] {
  const selected = selectedIds.length > 0 ? new Set(selectedIds) : null;

  return details.map((detail) => {
    const keys = Object.keys(detail.breakdown).filter((key) => !selected || selected.has(key));

    if (view === "aggregate") {
      let total: number | null = null;
      for (const key of keys) {
        const value = detail.breakdown[key];
        if (value === null) continue;
        total = (total ?? 0) + value;
      }
      return { timestamp: detail.timestamp, [aggregateDataKey]: total };
    }

    const row: TMetricRow = { timestamp: detail.timestamp };
    for (const key of keys) {
      row[key] = detail.breakdown[key];
    }
    return row;
  });
}
