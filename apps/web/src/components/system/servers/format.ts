export function formatCores(millicores: number): string {
  const cores = millicores / 1000;
  if (cores >= 10) return cores.toFixed(0);
  return (Math.round(cores * 10) / 10).toString();
}

export function formatMegabytes(megabytes: number): string {
  if (megabytes >= 1024) return `${(Math.round((megabytes / 1024) * 10) / 10).toString()} GB`;
  return `${Math.round(megabytes)} MB`;
}
