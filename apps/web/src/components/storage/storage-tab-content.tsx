"use client";

import S3BucketCard, { AddS3BucketCard } from "@/components/storage/s3-bucket-card";
import ErrorCard from "@/components/error-card";
import { useS3Buckets } from "@/components/storage/s3-buckets-provider";
import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

const placeholderArray = Array.from({ length: 4 }, (_, i) => i);

export default function StorageTabContent({ className }: { className?: string }) {
  const {
    teamId,
    query: { data, error, isPending },
  } = useS3Buckets();

  const s3Buckets = data?.buckets;

  if (error && !isPending && !s3Buckets) {
    return (
      <Wrapper className={className}>
        <ErrorCard message={error.message} />
      </Wrapper>
    );
  }

  if (isPending || !s3Buckets) {
    return (
      <Wrapper asElement="ol" className={className}>
        {placeholderArray.map((i) => (
          <S3BucketCard key={i} isPlaceholder={true} />
        ))}
      </Wrapper>
    );
  }

  return (
    <Wrapper asElement="ol" className={className}>
      {s3Buckets.map((s3Bucket) => (
        <S3BucketCard key={s3Bucket.id} s3Bucket={s3Bucket} teamId={teamId} />
      ))}
      <AddS3BucketCard teamId={teamId} />
    </Wrapper>
  );
}

function Wrapper({
  asElement = "div",
  className,
  children,
}: {
  asElement?: "div" | "ol";
  className?: string;
  children: ReactNode;
}) {
  const Element = asElement === "ol" ? "ol" : "div";
  return (
    <Element className={cn("-mx-1 flex w-[calc(100%+0.5rem)] flex-col", className)}>
      {children}
    </Element>
  );
}
