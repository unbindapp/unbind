import ErrorCard from "@/components/error-card";
import { useServices } from "@/components/service/services-provider";
import VolumeCard from "@/components/volume/volume-card";
import { volumesListQuery } from "@/lib/queries/storage";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

// Lists volumes that aren't mounted on any service (e.g. left behind by a
// deleted service) so they can be reattached or cleaned up. Renders nothing
// while there are no dangling volumes — there is deliberately no way to
// create a volume from here.
export default function VolumesSection() {
  const { teamId, projectId, environmentId } = useServices();

  const { data, error } = useQuery({
    ...volumesListQuery({ teamId, projectId, environmentId }),
    refetchInterval: 5000,
    enabled: environmentId !== "",
  });

  const danglingVolumes = useMemo(
    () => data?.volumes.filter((volume) => !volume.mounted_on_service_id),
    [data],
  );

  const showError = !data && error;

  if (!showError && (!danglingVolumes || danglingVolumes.length === 0)) {
    return null;
  }

  return (
    <div className="flex w-full flex-col pt-8">
      <div className="flex w-full flex-wrap items-center justify-between gap-4 px-1">
        <div className="flex min-w-0 flex-wrap items-center justify-start gap-2">
          <h1 className="min-w-0 pr-1.5 pl-2 text-2xl leading-tight font-semibold">Volumes</h1>
        </div>
      </div>
      <div className="flex w-full items-center justify-center pt-3">
        <ol className="flex w-full flex-wrap">
          {showError ? (
            <li className="w-full p-1">
              <ErrorCard message={error.message} />
            </li>
          ) : (
            danglingVolumes?.map((volume) => (
              <VolumeCard
                key={volume.id}
                volume={volume}
                teamId={teamId}
                projectId={projectId}
                environmentId={environmentId}
                className="w-full sm:w-1/2 lg:w-1/3"
              />
            ))
          )}
        </ol>
      </div>
    </div>
  );
}
