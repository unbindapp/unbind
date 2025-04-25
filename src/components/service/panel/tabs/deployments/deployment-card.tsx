import { useDeploymentPanel } from "@/components/deployment/panel/deployment-panel-provider";
import DeploymentStatusChip, {
  getDeploymentStatusChipColor,
} from "@/components/deployment/status-chip";
import BrandIcon from "@/components/icons/brand";
import DeploymentTime from "@/components/service/panel/tabs/deployments/deployment-time";
import { Button } from "@/components/ui/button";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { EllipsisVerticalIcon } from "lucide-react";
import { HTMLAttributes } from "react";

type TProps = HTMLAttributes<HTMLDivElement> &
  (
    | {
        deployment: TDeploymentShallow;
        service: TServiceShallow;
        currentDeployment: TDeploymentShallow | undefined;
        isPlaceholder?: never;
        withCurrentTag?: boolean;
      }
    | {
        deployment?: never;
        service?: never;
        currentDeployment?: never;
        isPlaceholder: true;
        withCurrentTag?: never;
      }
  );

export default function DeploymentCard({
  deployment,
  currentDeployment,
  service,
  isPlaceholder,
  ...rest
}: TProps) {
  const { openPanel } = useDeploymentPanel();

  const { title, titleNotFound } = getTitle(deployment, service, isPlaceholder);
  const brand = getBrand(service, isPlaceholder);

  return (
    <div
      {...rest}
      data-color={getDeploymentStatusChipColor({ deployment, isPlaceholder, currentDeployment })}
      data-placeholder={isPlaceholder ? true : undefined}
      className="group/card relative flex w-full flex-row items-stretch rounded-xl"
    >
      <button
        onClick={deployment ? () => openPanel(deployment.id) : undefined}
        className="has-hover:group-hover/card:bg-border/50 has-hover:group-hover/card:group-data-[color=destructive]/card:bg-destructive/7 has-hover:group-hover/card:group-data-[color=process]/card:bg-process/7 has-hover:group-hover/card:group-data-[color=success]/card:bg-success/7 has-hover:group-hover/card:group-data-[color=wait]/card:bg-wait/7 has-hover:hover:bg-border/50 has-hover:hover:group-data-[color=destructive]/card:bg-destructive/7 has-hover:hover:group-data-[color=process]/card:bg-process/7 has-hover:hover:group-data-[color=success]/card:bg-success/7 has-hover:hover:group-data-[color=wait]/card:bg-wait/7 focus-within:bg-border/50 focus-within:group-data-[color=success]/card:bg-success/7 focus-within:group-data-[color=destructive]/card:bg-destructive/7 focus-within:group-data-[color=process]/card:bg-process/7 focus-within:group-data-[color=wait]/card:bg-wait/7 focus-visible:bg-border/50 focus-visible:group-data-[color=process]/card:bg-process/7 focus-visible:group-data-[color=destructive]/card:bg-destructive/7 focus-visible:hover:group-data-[color=success]/card:bg-success/7 focus-visible:hover:group-data-[color=wait]/card:bg-wait/7 group-data-[color=destructive]/card:bg-destructive/4 group-data-[color=process]/card:bg-process/4 group-data-[color=success]/card:bg-success/4 group-data-[color=wait]/card:bg-wait/4 active:bg-border/50 active:group-data-[color=destructive]/card:bg-destructive/7 active:group-data-[color=process]/card:bg-process/7 active:group-data-[color=success]/card:bg-success/7 active:group-data-[color=wait]/card:bg-wait/7 group-data-[color=destructive]/card:border-destructive/12 group-data-[color=process]/card:border-process/12 group-data-[color=success]/card:border-success/12 group-data-[color=wait]/card:border-wait/12 focus-visible:ring-offset-background focus-visible:ring-primary/50 flex min-w-0 flex-1 flex-col rounded-xl border px-3.5 py-3 text-left focus-visible:ring-1 focus-visible:ring-offset-2 focus-visible:outline-hidden sm:flex-row sm:items-center sm:py-3.5 sm:pr-13 sm:pl-4"
      >
        <div className="flex shrink-0 items-center justify-start pr-8 sm:w-34 sm:pr-3">
          <DeploymentStatusChip
            deployment={deployment}
            currentDeployment={currentDeployment}
            isPlaceholder={isPlaceholder}
          />
        </div>
        <div className="mt-2 flex shrink-0 flex-col items-start justify-center sm:mt-0">
          <BrandIcon
            brand={brand}
            color="brand"
            className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton size-6 group-data-placeholder/card:rounded-full group-data-placeholder/card:text-transparent"
          />
        </div>
        <div className="mt-1.5 flex min-w-0 flex-1 flex-col items-start gap-1.25 pr-2 pb-0.5 sm:mt-0 sm:pl-3">
          <p
            data-no-title={titleNotFound ? true : undefined}
            className="data-no-title:bg-border data-no-title:text-muted-foreground group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton max-w-full min-w-0 shrink leading-tight group-data-placeholder/card:rounded-md group-data-placeholder/card:text-transparent data-no-title:-my-0.25 data-no-title:rounded data-no-title:px-1.5 data-no-title:py-0.25"
          >
            {title}
          </p>
          {isPlaceholder ? (
            <DeploymentTime isPlaceholder={true} />
          ) : (
            <DeploymentTime deployment={deployment} service={service} />
          )}
        </div>
      </button>
      <Button
        size="icon"
        variant="ghost"
        className="text-muted-more-foreground active:bg-foreground/6 has-hover:hover:bg-foreground/6 focus-visible:bg-foreground/6 absolute top-1 right-1 shrink-0 rounded-lg group-data-placeholder/line:text-transparent sm:top-1/2 sm:right-2 sm:-translate-y-1/2"
      >
        {isPlaceholder ? (
          <div className="group-data-placeholder/card:bg-muted-foreground group-data-placeholder/card:animate-skeleton size-5 group-data-placeholder/card:rounded-md" />
        ) : (
          <EllipsisVerticalIcon className="size-6" />
        )}
      </Button>
    </div>
  );
}

function getTitle(
  deployment?: TDeploymentShallow,
  service?: TServiceShallow,
  isPlaceholder?: boolean,
) {
  if (isPlaceholder || !service || !deployment)
    return { title: "Loading title...", titleNotFound: false };
  if (service.config.type === "docker-image")
    return {
      title: service.config.image || "Image unavailable",
      titleNotFound: !service.config.image,
    };
  if (service.config.type === "github")
    return {
      title: deployment.commit_message || "Commit message unavailable",
      titleNotFound: !deployment.commit_message,
    };
  if (service.config.type === "database") {
    return {
      title: service.config.database_type
        ? `${service.config.database_type}${service.config.database_version ? `:${service.config.database_version}` : ""}`
        : "Unknown database",
      titleNotFound: !service.config.database_type,
    };
  }
  return {
    title: "Unknown source",
    titleNotFound: false,
  };
}

function getBrand(service?: TServiceShallow, isPlaceholder?: boolean) {
  if (isPlaceholder && !service) return "github";
  if (service?.config.type === "docker-image") return "docker";
  if (service?.config.type === "database") return "database";
  return "github";
}
