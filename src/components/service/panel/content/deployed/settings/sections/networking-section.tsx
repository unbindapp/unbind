import ErrorLine from "@/components/error-line";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import { useServiceEndpoints } from "@/components/service/service-endpoints-provider";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { cn } from "@/components/ui/utils";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { GlobeIcon, GlobeLockIcon, NetworkIcon } from "lucide-react";

type TProps = {
  service: TServiceShallow;
};

export default function NetworkingSection({ service }: TProps) {
  if (service.type === "github") {
    if (
      !service.git_repository_owner ||
      !service.git_repository ||
      !service.config.git_branch ||
      service.github_installation_id === undefined
    ) {
      return (
        <ErrorWithWrapper message="Git owner, repository, installation ID, or branch is not found." />
      );
    }

    return <AllServiceTypesSection service={service} />;
  }

  if (service.type === "docker-image") {
    const arr = service.config.image?.split(":");
    const image = arr?.[0];
    const tag = arr && arr.length > 1 ? arr?.[1] : "latest";

    if (!image || !tag) return <ErrorWithWrapper message="Image or tag is not found." />;

    return <AllServiceTypesSection service={service} />;
  }

  if (service.type === "database") {
    if (!service.database_type || !service.database_version) {
      return <ErrorWithWrapper message="Database type or version is not found." />;
    }

    return <AllServiceTypesSection service={service} />;
  }

  return <ErrorWithWrapper message="Unsupported service type" />;
}

function AllServiceTypesSection({ service }: { service: TServiceShallow }) {
  const {
    query: { data: endpointsData, isPending: isPendingEndpoints, error: errorEndpoints },
  } = useServiceEndpoints();

  return (
    <SettingsSection title="Networking" id="networking" Icon={NetworkIcon}>
      {(service.type === "github" || service.type === "docker-image") && (
        <Block>
          <BlockItem className="w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle>Public Networking</BlockItemTitle>
              <BlockItemDescription>
                Communicate with the service over the internet.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <div className="flex w-full flex-col gap-2">
                {!endpointsData && !isPendingEndpoints && errorEndpoints && (
                  <ErrorLine
                    message={errorEndpoints.message}
                    className="border-destructive/16 rounded-lg border py-2.5"
                  />
                )}
                {!endpointsData && isPendingEndpoints && (
                  <BlockItemButtonLike
                    isPending={true}
                    key="loading"
                    asElement="div"
                    text="loading.unbind"
                    Icon={({ className }: { className?: string }) => (
                      <GlobeLockIcon className={cn("scale-90", className)} />
                    )}
                  />
                )}
                {endpointsData?.endpoints.external?.map((hostObject) => (
                  <BlockItemButtonLike
                    classNameText="whitespace-normal overflow-auto"
                    key={hostObject.host + hostObject.port}
                    asElement="LinkButton"
                    href={
                      hostObject.port.port === 80
                        ? `http://${hostObject.host}`
                        : `https://${hostObject.host}${hostObject.port.port !== 443 ? `:${hostObject.port}` : ""}`
                    }
                    text={`${hostObject.host}${hostObject.port.port !== 443 ? `:${hostObject.port}` : ""}`}
                    Icon={({ className }: { className?: string }) => (
                      <GlobeIcon className={cn("scale-90", className)} />
                    )}
                  />
                ))}
              </div>
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
      <Block>
        <BlockItem className="w-full md:w-full">
          <BlockItemHeader type="column">
            <BlockItemTitle>Private Networking</BlockItemTitle>
            <BlockItemDescription>
              {"Communicate with the service from within the Unbind's network."}
            </BlockItemDescription>
          </BlockItemHeader>
          <BlockItemContent>
            <div className="flex w-full flex-col gap-2">
              {!endpointsData && !isPendingEndpoints && errorEndpoints && (
                <ErrorLine
                  message={errorEndpoints.message}
                  className="border-destructive/16 rounded-lg border py-2.5"
                />
              )}
              {!endpointsData && isPendingEndpoints && (
                <BlockItemButtonLike
                  isPending={true}
                  key="loading"
                  asElement="div"
                  text="loading.unbind:3000"
                  Icon={({ className }: { className?: string }) => (
                    <GlobeLockIcon className={cn("scale-90", className)} />
                  )}
                />
              )}
              {endpointsData?.endpoints.internal?.flatMap((hostObject) =>
                hostObject.ports.map((portObject) => (
                  <BlockItemButtonLike
                    classNameText="whitespace-normal overflow-auto"
                    key={`${hostObject.dns}:${portObject.port}`}
                    asElement="div"
                    text={`${hostObject.dns}:${portObject.port}`}
                    Icon={({ className }: { className?: string }) => (
                      <GlobeLockIcon className={cn("scale-90", className)} />
                    )}
                  />
                )),
              )}
            </div>
          </BlockItemContent>
        </BlockItem>
      </Block>
    </SettingsSection>
  );
}
