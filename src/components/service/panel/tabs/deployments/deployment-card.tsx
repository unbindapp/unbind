import { useDeploymentPanel } from "@/components/deployment/panel/deployment-panel-provider";
import DeploymentStatusChip, {
  getDeploymentStatusChipColor,
} from "@/components/deployment/status-chip";
import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { useServicesUtils } from "@/components/project/services-provider";
import { useDeploymentsUtils } from "@/components/deployment/deployments-provider";
import DeploymentTime from "@/components/service/panel/tabs/deployments/deployment-time";
import { useService, useServiceUtils } from "@/components/service/service-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { defaultAnimationMs } from "@/lib/constants";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";
import { EllipsisVerticalIcon, RocketIcon, RotateCcwIcon } from "lucide-react";
import { HTMLAttributes, ReactNode, useRef, useState } from "react";

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
      <div className="absolute top-1 right-1 shrink-0 sm:top-1/2 sm:right-2 sm:-translate-y-1/2">
        {isPlaceholder ? (
          <Button size="icon" variant="ghost" disabled fadeOnDisabled={false}>
            <div className="bg-muted-foreground animate-skeleton size-5 rounded-md" />
          </Button>
        ) : (
          <ThreeDotButton deployment={deployment} currentDeployment={currentDeployment} />
        )}
      </div>
    </div>
  );
}

function ThreeDotButton({
  deployment,
  currentDeployment,
}: {
  deployment: TDeploymentShallow;
  currentDeployment: TDeploymentShallow | undefined;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isCurrentDeployment = deployment.id === currentDeployment?.id;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="text-muted-more-foreground active:bg-foreground/6 has-hover:hover:bg-foreground/6 focus-visible:bg-foreground/6"
        >
          <EllipsisVerticalIcon className="size-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="z-50 w-40"
        sideOffset={-1}
        data-open={isOpen ? true : undefined}
        align="end"
        forceMount={true}
      >
        <ScrollArea>
          <DropdownMenuGroup>
            {isCurrentDeployment && (
              <RestartTrigger closeDropdown={() => setIsOpen(false)}>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <RotateCcwIcon className="-ml-0.5 size-5" />
                  <p className="min-w-0 shrink leading-tight">Restart</p>
                </DropdownMenuItem>
              </RestartTrigger>
            )}
            <RedeployTrigger closeDropdown={() => setIsOpen(false)} deployment={deployment}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <RocketIcon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Redeploy</p>
              </DropdownMenuItem>
            </RedeployTrigger>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RestartTrigger({
  closeDropdown,
  children,
}: {
  closeDropdown: () => void;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { teamId, projectId, environmentId, serviceId } = useService();

  const props = { teamId, projectId, environmentId, serviceId };
  const { refetch: refetchDeployments } = useDeploymentsUtils({
    ...props,
  });
  const { refetch: refetchService } = useServiceUtils({
    ...props,
  });
  const { refetch: refetchServices } = useServicesUtils({
    ...props,
  });

  const {
    mutate: restartDeployment,
    isPending,
    error,
    reset,
  } = api.instances.restart.useMutation({
    onSuccess: async () => {
      await Promise.all([refetchServices(), refetchService(), refetchDeployments()]);
      setIsOpen(false);
      closeDropdown();
    },
  });

  const timeout = useRef<NodeJS.Timeout | null>(null);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          closeDropdown();
          if (timeout.current) clearTimeout(timeout.current);
          timeout.current = setTimeout(() => {
            reset();
          }, defaultAnimationMs);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="max-w-md">
        <DialogHeader>
          <DialogTitle>Restart</DialogTitle>
          <DialogDescription>Are you sure you want to restart this deployment?</DialogDescription>
        </DialogHeader>
        {error && <ErrorLine message={error?.message} />}
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <DialogClose asChild className="text-muted-foreground">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={() =>
              restartDeployment({
                teamId,
                projectId,
                environmentId,
                serviceId,
              })
            }
            isPending={isPending}
          >
            Restart
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RedeployTrigger({
  deployment,
  closeDropdown,
  children,
}: {
  deployment: TDeploymentShallow;
  closeDropdown: () => void;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { teamId, projectId, environmentId, serviceId } = useService();

  const props = { teamId, projectId, environmentId, serviceId };
  const { refetch: refetchDeployments } = useDeploymentsUtils({
    ...props,
  });
  const { refetch: refetchService } = useServiceUtils({
    ...props,
  });
  const { refetch: refetchServices } = useServicesUtils({
    ...props,
  });

  const {
    mutate: redeployDeployment,
    isPending,
    error,
    reset,
  } = api.deployments.redeploy.useMutation({
    onSuccess: async () => {
      await Promise.all([refetchServices(), refetchService(), refetchDeployments()]);
      setIsOpen(false);
      closeDropdown();
    },
  });

  const timeout = useRef<NodeJS.Timeout | null>(null);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          closeDropdown();
          if (timeout.current) clearTimeout(timeout.current);
          timeout.current = setTimeout(() => {
            reset();
          }, defaultAnimationMs);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="max-w-md">
        <DialogHeader>
          <DialogTitle>Redeploy</DialogTitle>
          <DialogDescription>Are you sure you want to redeploy this deployment?</DialogDescription>
        </DialogHeader>
        {error && <ErrorLine message={error?.message} />}
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <DialogClose asChild className="text-muted-foreground">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={() =>
              redeployDeployment({
                teamId,
                projectId,
                environmentId,
                serviceId,
                deploymentId: deployment.id,
              })
            }
            isPending={isPending}
          >
            Redeploy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
