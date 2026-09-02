const s3BucketLabelSeparator = "||||||";

export function getS3BucketItemLabel(s3Bucket: { name: string; bucket: string }): string {
  return `${s3Bucket.name}${s3BucketLabelSeparator}${s3Bucket.bucket}`;
}

export function splitS3BucketItemLabel(label: string) {
  const [name = "", bucket = ""] = label.split(s3BucketLabelSeparator);
  return { name, bucket };
}
