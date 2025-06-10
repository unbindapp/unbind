export const sourceAndBucketSeparator = "||||||";

export function getSourceAndBucketLabelFromValue(value: string): string {
  const parts = value.split(sourceAndBucketSeparator);
  return `${parts[1]}${sourceAndBucketSeparator}${parts[parts.length - 1]}`;
}

export function getSourceIdAndBucketNameFromValue(value: string) {
  const parts = value.split(sourceAndBucketSeparator);
  if (parts.length < 3) {
    return {
      sourceId: "",
      bucketName: "",
    };
  }
  return {
    sourceId: parts[parts.length - 2],
    bucketName: parts[parts.length - 1],
  };
}

export function getValueFromSourceAndBucket(
  sourceId: string | undefined,
  sourceName: string | undefined,
  bucketName: string | undefined,
): string {
  if (!sourceId || !sourceName || !bucketName) return "";
  return `${sourceName} / ${bucketName}${sourceAndBucketSeparator}${sourceName}${sourceAndBucketSeparator}${sourceId}${sourceAndBucketSeparator}${bucketName}`;
}
