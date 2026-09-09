// Watch paths are staged as one string so the staged-changes store can compare them
const separator = "\n";

export function splitWatchPaths(value: string): string[] {
  const patterns: string[] = [];
  for (const part of value.split(/[\n,]/)) {
    const pattern = part.trim();
    if (!pattern || patterns.includes(pattern)) continue;
    patterns.push(pattern);
  }
  return patterns;
}

export function joinWatchPaths(patterns: string[]): string {
  return patterns.join(separator);
}

export function formatWatchPaths(value: string): string {
  const patterns = splitWatchPaths(value);
  if (patterns.length === 0) return "Every push";
  return patterns.join(", ");
}
