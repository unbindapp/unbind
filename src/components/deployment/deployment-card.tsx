import DeploymentStatusChip, {
  getDeploymentStatusChipColor,
} from "@/components/deployment/deployment-status-chip";
import { useDeploymentsUtils } from "@/components/deployment/deployments-provider";
import { useDeploymentPanel } from "@/components/deployment/panel/deployment-panel-provider";
import ErrorLine from "@/components/error-line";
import AnimatedTimerIcon from "@/components/icons/animated-timer";
import BrandIcon from "@/components/icons/brand";
import { useNow } from "@/components/providers/now-provider";
import { useService, useServiceUtils } from "@/components/service/service-provider";
import { useServicesUtils } from "@/components/service/services-provider";
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
import { cn } from "@/components/ui/utils";
import { defaultAnimationMs, sourceToTitle } from "@/lib/constants";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { getDurationStr, useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";
import {
  EllipsisVerticalIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  RewindIcon,
  RocketIcon,
  RotateCcwIcon,
} from "lucide-react";
import { ResultAsync } from "neverthrow";
import Image from "next/image";
import { HTMLAttributes, ReactNode, useRef, useState } from "react";
import { toast } from "sonner";

type TProps = HTMLAttributes<HTMLDivElement> &
  (
    | {
        deployment: TDeploymentShallow;
        currentDeployment: TDeploymentShallow | undefined;

        isPlaceholder?: never;
        withCurrentTag?: boolean;
      }
    | {
        deployment?: never;
        currentDeployment?: never;
        isPlaceholder: true;
        withCurrentTag?: never;
      }
  ) & { service: TServiceShallow };

export default function DeploymentCard({
  deployment,
  currentDeployment,
  service,
  isPlaceholder,
  ...rest
}: TProps) {
  const { openPanel } = useDeploymentPanel();

  const { title, titleNotFound } = getTitle({ deployment, service, isPlaceholder });
  const brand = getBrand(service, isPlaceholder);

  const isCurrentDeployment = isPlaceholder ? false : currentDeployment?.id === deployment.id;
  const isDeployed = isPlaceholder
    ? false
    : deployment.status === "build-succeeded" ||
      deployment.status === "launching" ||
      deployment.status === "launch-error" ||
      deployment.status === "crashing" ||
      deployment.status === "active" ||
      deployment.status === "removed";

  return (
    <div
      {...rest}
      data-color={getDeploymentStatusChipColor({ deployment, isPlaceholder })}
      data-placeholder={isPlaceholder ? true : undefined}
      className="group/card relative flex w-full flex-row items-stretch rounded-xl"
    >
      <button
        onClick={
          deployment
            ? () => openPanel(deployment.id, isDeployed ? "deploy-logs" : undefined)
            : undefined
        }
        className="has-hover:group-hover/card:bg-border/50 has-hover:group-hover/card:group-data-[color=destructive]/card:bg-destructive/7 has-hover:group-hover/card:group-data-[color=process]/card:bg-process/7 has-hover:group-hover/card:group-data-[color=success]/card:bg-success/7 has-hover:group-hover/card:group-data-[color=wait]/card:bg-wait/7 has-hover:hover:bg-border/50 has-hover:hover:group-data-[color=destructive]/card:bg-destructive/7 has-hover:hover:group-data-[color=process]/card:bg-process/7 has-hover:hover:group-data-[color=success]/card:bg-success/7 has-hover:hover:group-data-[color=wait]/card:bg-wait/7 focus-within:bg-border/50 focus-within:group-data-[color=success]/card:bg-success/7 focus-within:group-data-[color=destructive]/card:bg-destructive/7 focus-within:group-data-[color=process]/card:bg-process/7 focus-within:group-data-[color=wait]/card:bg-wait/7 focus-visible:bg-border/50 focus-visible:group-data-[color=process]/card:bg-process/7 focus-visible:group-data-[color=destructive]/card:bg-destructive/7 focus-visible:hover:group-data-[color=success]/card:bg-success/7 focus-visible:hover:group-data-[color=wait]/card:bg-wait/7 group-data-[color=destructive]/card:bg-destructive/4 group-data-[color=process]/card:bg-process/4 group-data-[color=success]/card:bg-success/4 group-data-[color=wait]/card:bg-wait/4 active:bg-border/50 active:group-data-[color=destructive]/card:bg-destructive/7 active:group-data-[color=process]/card:bg-process/7 active:group-data-[color=success]/card:bg-success/7 active:group-data-[color=wait]/card:bg-wait/7 group-data-[color=destructive]/card:border-destructive/12 group-data-[color=process]/card:border-process/12 group-data-[color=success]/card:border-success/12 group-data-[color=wait]/card:border-wait/12 focus-visible:ring-offset-background focus-visible:ring-primary/50 flex min-w-0 flex-1 flex-col rounded-xl border px-3.5 py-3 text-left focus-visible:ring-1 focus-visible:ring-offset-2 focus-visible:outline-hidden sm:flex-row sm:items-center sm:py-3.5 sm:pr-13 sm:pl-4"
      >
        <div className="flex shrink-0 items-center justify-start pr-8 sm:w-34 sm:pr-3">
          <DeploymentStatusChip deployment={deployment} isPlaceholder={isPlaceholder} />
        </div>
        <div className="mt-2 flex shrink-0 flex-col items-start justify-center sm:mt-0">
          <BrandIcon
            brand={brand}
            color="brand"
            className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton size-6 group-data-placeholder/card:rounded-full group-data-placeholder/card:text-transparent"
          />
        </div>
        <div className="mt-1.5 flex min-w-0 flex-1 flex-col items-start gap-1.25 pr-2 pb-0.5 sm:mt-0 sm:pl-3">
          <div className="flex w-full flex-col items-start justify-start gap-0.5">
            <p
              data-no-title={titleNotFound ? true : undefined}
              className="data-no-title:bg-border data-no-title:text-muted-foreground group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton max-w-full min-w-0 shrink leading-tight group-data-placeholder/card:rounded-md group-data-placeholder/card:text-transparent data-no-title:-my-0.25 data-no-title:rounded data-no-title:px-1.5 data-no-title:py-0.25"
            >
              {title}
            </p>
          </div>
          {isPlaceholder ? (
            <DeploymentInfo isPlaceholder={true} service={service} />
          ) : (
            <DeploymentInfo deployment={deployment} service={service} />
          )}
        </div>
      </button>
      <div className="absolute top-1 right-1 shrink-0 sm:top-1/2 sm:right-2 sm:-translate-y-1/2">
        {isPlaceholder ? (
          <Button size="icon" variant="ghost" disabled fadeOnDisabled={false}>
            <div className="bg-muted-foreground animate-skeleton size-5 rounded-md" />
          </Button>
        ) : (
          <ThreeDotButton deployment={deployment} isCurrentDeployment={isCurrentDeployment} />
        )}
      </div>
    </div>
  );
}

function ThreeDotButton({
  deployment,
  isCurrentDeployment,
}: {
  deployment: TDeploymentShallow;
  isCurrentDeployment: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

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
            {deployment.status === "removed" && (
              <RedeployTrigger
                title="Rollback"
                description="Are you sure you want to rollback this deployment?"
                buttonText="Rollback"
                skipBuildIfPossible={true}
                closeDropdown={() => setIsOpen(false)}
                deployment={deployment}
              >
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <RewindIcon className="-ml-0.5 size-5" />
                  <p className="min-w-0 shrink leading-tight">Rollback</p>
                </DropdownMenuItem>
              </RedeployTrigger>
            )}
            <RedeployTrigger
              showSkipBuildIfPossibleToggle={isCurrentDeployment}
              closeDropdown={() => setIsOpen(false)}
              deployment={deployment}
            >
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
      const result = await ResultAsync.fromPromise(
        Promise.all([refetchServices(), refetchService(), refetchDeployments()]),
        () => new Error("Failed to refetch data"),
      );
      if (result.isErr()) {
        toast.error("Failed to refetch", {
          description: "Restarted successfuly but couldn't refetch the new data.",
          duration: 5000,
        });
      }
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
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
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
  title,
  description,
  buttonText,
  skipBuildIfPossible,
  showSkipBuildIfPossibleToggle,
  children,
}: {
  deployment: TDeploymentShallow;
  closeDropdown: () => void;
  skipBuildIfPossible?: boolean;
  showSkipBuildIfPossibleToggle?: boolean;
  title?: string;
  description?: string;
  buttonText?: string;
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
    mutateAsync: redeployDeployment,
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

  const form = useAppForm({
    defaultValues: {
      skipBuildIfPossible: skipBuildIfPossible || false,
    },
    onSubmit: async ({ value }) => {
      await redeployDeployment({
        teamId,
        projectId,
        environmentId,
        serviceId,
        deploymentId: deployment.id,
        skipBuildIfPossible: value.skipBuildIfPossible,
      });
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
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>{title || "Redeploy"}</DialogTitle>
          <DialogDescription>
            {description || "Are you sure you want to redeploy this deployment?"}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex w-full flex-col gap-5"
        >
          {showSkipBuildIfPossibleToggle && (
            <div className="-mx-2.5 flex w-full max-w-[calc(100%+1.25rem)] justify-start">
              <form.AppField
                name="skipBuildIfPossible"
                children={(field) => (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      field.handleChange(!field.state.value);
                    }}
                    data-checked={field.state.value ? true : undefined}
                    className="group/button has-hover:hover:bg-border -my-2 flex cursor-pointer items-center justify-between gap-4 py-2 pr-2 pl-2.5 text-left font-semibold"
                  >
                    <p className="min-w-0 shrink">Skip build if possible</p>
                    <div className="bg-muted-more-foreground group-data-checked/button:bg-foreground relative h-5 w-9 shrink-0 rounded-full transition">
                      <div className="bg-background absolute top-0.5 left-0.5 size-4 rounded-full transition group-data-checked/button:translate-x-4" />
                    </div>
                  </Button>
                )}
              />
            </div>
          )}
          {error && <ErrorLine message={error?.message} />}
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <DialogClose asChild className="text-muted-foreground">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <form.Subscribe
              selector={(state) => ({ isSubmitting: state.isSubmitting })}
              children={({ isSubmitting }) => (
                <form.SubmitButton isPending={isPending || isSubmitting}>
                  {buttonText || "Redeploy"}
                </form.SubmitButton>
              )}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getTitle({
  deployment,
  service,
  isPlaceholder,
}: {
  deployment?: TDeploymentShallow;
  service: TServiceShallow;
  isPlaceholder?: boolean;
}): {
  title: string;
  titleNotFound: boolean;
} {
  if (isPlaceholder || !service || !deployment) {
    return { title: "Loading title...", titleNotFound: false };
  }
  if (service.type === "docker-image" && deployment.image) {
    const title = deployment.image.endsWith(":latest")
      ? deployment.image.slice(0, -7) // Remove ":latest"
      : deployment.image;
    return {
      title: title || "Image unavailable",
      titleNotFound: !deployment.image,
    };
  }
  if (service.type === "github") {
    return {
      title: deployment.commit_message || "Commit message unavailable",
      titleNotFound: !deployment.commit_message,
    };
  }
  if (service.type === "database") {
    return {
      title: service.database_type
        ? `${service.database_type}${service.database_version ? `:${service.database_version}` : ""}`
        : "Unknown database",
      titleNotFound: !service.database_type,
    };
  }
  return {
    title: "Unknown source",
    titleNotFound: false,
  };
}

function getBrand(service?: TServiceShallow, isPlaceholder?: boolean) {
  if (isPlaceholder && !service) return "github";
  if (service?.type === "docker-image") return "docker";
  if (service?.type === "database") return "database";
  return "github";
}

type TDeploymentInfoProps = {
  className?: string;
  service: TServiceShallow;
} & (
  | {
      deployment: TDeploymentShallow;
      isPlaceholder?: never;
    }
  | {
      deployment?: never;
      isPlaceholder: true;
    }
);

function DeploymentInfo({ deployment, service, isPlaceholder, className }: TDeploymentInfoProps) {
  const now = useNow();
  const { str: deploymentTimeStr } = useTimeDifference({
    timestamp: isPlaceholder ? Date.now() : new Date(deployment.created_at).getTime(),
  });

  const isBuilding =
    deployment?.status === "build-queued" ||
    deployment?.status === "build-pending" ||
    deployment?.status === "build-running" ||
    deployment?.status === "build-succeeded";

  const durationStr = isPlaceholder
    ? undefined
    : deployment.completed_at && deployment.created_at
      ? getDurationStr({ end: deployment.completed_at, start: deployment.created_at })
      : deployment.created_at && isBuilding
        ? getDurationStr({ end: now, start: deployment.created_at })
        : undefined;

  return (
    <div
      data-placeholder={isPlaceholder ? true : undefined}
      className={cn("group/time flex min-w-0 shrink items-start justify-start gap-1.5", className)}
    >
      {isPlaceholder && service.type === "github" ? (
        <div className="bg-muted-foreground animate-skeleton -mt-[0.5px] size-4.5 rounded-full" />
      ) : deployment?.commit_author?.avatar_url ? (
        <Image
          alt="Avatar"
          width={24}
          height={24}
          className="bg-border -mt-[0.5px] size-4.5 rounded-full border"
          src={deployment.commit_author.avatar_url}
        />
      ) : (
        <div className="-mt-[0.5px] -ml-1.5 h-4.5" />
      )}
      <div className="flex min-w-0 shrink flex-col flex-wrap justify-start gap-0.5 font-mono text-sm leading-tight lg:flex-row lg:items-center lg:space-x-1.5">
        <p className="text-muted-foreground group-data-placeholder/time:bg-muted-foreground group-data-placeholder/time:animate-skeleton max-w-full min-w-0 shrink leading-tight group-data-placeholder/time:rounded-md group-data-placeholder/time:text-transparent">
          {isPlaceholder
            ? "1 hr. ago via GitHub | 90s"
            : `${deploymentTimeStr} via ${sourceToTitle[service.type] || "Unknown"}`}
        </p>
        <div className="flex max-w-full min-w-0 shrink gap-0.5 space-x-1.5">
          {deployment?.git_branch && (
            <span className="text-muted-more-foreground hidden leading-tight lg:inline-block">
              |
            </span>
          )}
          {deployment?.git_branch && (
            <p className="text-muted-foreground max-w-full min-w-0 shrink leading-tight">
              <GitBranchIcon className="mr-[0.5ch] inline-block size-3.5" />
              {deployment.git_branch}
            </p>
          )}
          {deployment?.commit_sha && (
            <span className="text-muted-more-foreground leading-tight">|</span>
          )}
          {deployment?.commit_sha && (
            <p className="text-muted-foreground max-w-full min-w-0 shrink leading-tight">
              <GitCommitHorizontalIcon className="mr-[0.5ch] inline-block size-3.5" />
              {deployment.commit_sha.slice(0, 6)}
            </p>
          )}
          {durationStr && (
            <span
              data-has-prev={deployment?.commit_sha || deployment?.git_branch ? true : undefined}
              className="text-muted-more-foreground hidden leading-tight data-has-prev:inline-block lg:inline-block data-has-prev:lg:inline-block"
            >
              |
            </span>
          )}
          {durationStr && (
            <p className="text-muted-foreground max-w-full min-w-0 shrink leading-tight">
              <AnimatedTimerIcon
                animate={isBuilding}
                className="-mt-0.75 mr-[0.4ch] inline-block size-3.5 shrink-0"
              />
              {durationStr}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
