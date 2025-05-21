"use client";

import S3SourceCard, {
  NewS3SourceCard,
} from "@/app/(team)/[team_id]/settings/storage/_components/s3-source-card";
import ErrorCard from "@/components/error-card";
import { useS3Sources } from "@/components/storage/s3-sources-provider";
import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

const placeholderArray = Array.from({ length: 4 }, (_, i) => i);

export default function StorageTabContent({ className }: { className?: string }) {
  const {
    teamId,
    query: { data, error, isPending },
  } = useS3Sources();

  const s3Sources = data?.sources;

  if (error && !isPending && !s3Sources) {
    return (
      <Wrapper className={className}>
        <ErrorCard message={error.message} />
      </Wrapper>
    );
  }

  if (isPending || !s3Sources) {
    return (
      <Wrapper asElement="ol" className={className}>
        {placeholderArray.map((i) => (
          <S3SourceCard key={i} isPlaceholder={true} />
        ))}
      </Wrapper>
    );
  }

  return (
    <Wrapper asElement="ol" className={className}>
      {s3Sources.map((s3Source) => (
        <S3SourceCard key={s3Source.id} s3Source={s3Source} teamId={teamId} />
      ))}
      <NewS3SourceCard teamId={teamId} />
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
