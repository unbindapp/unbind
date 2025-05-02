"use client";

import EnvironmentCard, {
  NewEnvironmentCard,
} from "@/app/(project)/[team_id]/project/[project_id]/settings/environments/_components/environment-card";
import { useEnvironments } from "@/components/environment/environments-provider";
import ErrorCard from "@/components/error-card";
import { cn } from "@/components/ui/utils";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { ReactNode, useEffect, useState } from "react";

const placeholderArray = Array.from({ length: 4 }, (_, i) => i);

export default function EnvironmentsTabContent() {
  const {
    query: { data, error, isPending },
    teamId,
    projectId,
  } = useEnvironments();

  const environments = data?.environments;

  const { environmentId } = useIdsFromPathname();
  const [lastSelectedEnvironmentId, setLastSelectedEnvironmentId] = useState<string | null>(
    environmentId,
  );

  useEffect(() => {
    setLastSelectedEnvironmentId(environmentId);
  }, [environmentId]);

  if (error && !isPending && !environments) {
    return (
      <Wrapper>
        <ErrorCard message={error.message} />
      </Wrapper>
    );
  }

  if (isPending || !environments) {
    return (
      <Wrapper asElement="ol" className="-mx-1 mt-2 w-[calc(100%+0.5rem)] flex-row flex-wrap">
        {placeholderArray.map((i) => (
          <EnvironmentCard key={i} isPlaceholder={true} />
        ))}
      </Wrapper>
    );
  }

  return (
    <Wrapper asElement="ol" className="-mx-1 mt-2 w-[calc(100%+0.5rem)] flex-row flex-wrap">
      {environments.map((environment) => (
        <EnvironmentCard
          key={environment.id}
          environment={environment}
          teamId={teamId}
          projectId={projectId}
          isSelected={environment.id === lastSelectedEnvironmentId}
          disableDelete={environments.length <= 1}
          onClick={() => {
            setLastSelectedEnvironmentId(environment.id);
          }}
        />
      ))}
      <NewEnvironmentCard teamId={teamId} projectId={projectId} />
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
  return <Element className={cn("mt-3 flex w-full flex-col", className)}>{children}</Element>;
}
