import ErrorLine from "@/components/error-line";
import { useServices, useServicesUtils } from "@/components/project/services-provider";
import { useSystem } from "@/components/system/system-provider";
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
import { defaultAnimationMs } from "@/lib/constants";
import { formatGB } from "@/lib/helpers/format-gb";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TVolumeShallow } from "@/server/trpc/api/services/types";
import { TVolumeType } from "@/server/trpc/api/storage/volumes/types";
import { api } from "@/server/trpc/setup/client";
import { HourglassIcon, RotateCcwIcon, ScalingIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

type TProps = {
  volume: TVolumeShallow;
};

const volumeMaxStorageGb = 200;

export default function ExpandSection({ volume }: TProps) {
  const { data: systemData, isPending: isPendingSystem, error: errorSystem } = useSystem();

  const minStorageGb = volume.capacity_gb;
  const maxStorageGb = Math.min(
    volumeMaxStorageGb,
    systemData?.data.storage.maximum_storage_gb || 100,
  );
  const storageStepGb = systemData?.data.storage.storage_step_gb || 1;
  const currentCapacityGb = volume.capacity_gb;

  const form = useAppForm({
    defaultValues: {
      capacityGb: minStorageGb,
    },
    validators: {
      onChange: ({ value }) => {
        if (value.capacityGb < minStorageGb) {
          return "Volume size cannot be less than the current size.";
        }

        return undefined;
      },
    },
  });

  const isPending = isPendingSystem;
  const error = errorSystem;
  const hasData = systemData !== undefined;

  if (!hasData && isPending) {
    return (
      <div className="flex w-full flex-col gap-2.5 text-transparent">
        <div className="flex w-full justify-start px-1.5">
          <p className="bg-muted-foreground animate-skeleton max-w-full rounded-md">
            Loading the details of the volume...
          </p>
        </div>
        <div className="flex w-full justify-start px-1.5">
          <p className="bg-foreground animate-skeleton max-w-full rounded-md">Size: 10GB</p>
        </div>
        <div className="animate-skeleton -mt-0.5 flex w-full items-center gap-3 px-1.5 py-2.25 text-xs md:max-w-xl">
          <p className="bg-muted-foreground rounded-sm">10GB</p>
          <div className="relative flex h-4 flex-1 items-center justify-center">
            <div className="bg-muted-foreground h-1.5 flex-1 rounded-full" />
            <div className="bg-foreground absolute top-1/2 left-0 size-4 -translate-y-1/2 rounded-full" />
          </div>
          <p className="bg-muted-foreground rounded-sm">100GB</p>
        </div>
      </div>
    );
  }

  if (!hasData && !isPending && error) {
    return <ErrorLine message={error.message} />;
  }

  if (volume.is_pending_resize) {
    return (
      <div className="flex w-full flex-col gap-2 md:max-w-xl">
        <div className="bg-warning/8 border-warning/8 text-warning flex w-full items-start justify-start gap-2 rounded-lg border px-3 py-2.5 font-medium">
          <HourglassIcon className="animate-hourglass mt-0.5 -ml-0.5 size-4" />
          <p className="min-w-0 shrink leading-tight">
            Expanding the volume. This could take a couple of minutes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 md:max-w-xl">
      <div className="flex w-full justify-start px-1.5">
        <p className="text-muted-foreground">
          Expand the size of the volume. Keep in mind that the size {"can't"} be reduced.
        </p>
      </div>
      <form.Subscribe
        selector={(state) => ({ values: state.values })}
        children={({ values }) => (
          <div className="flex w-full justify-start px-1.5">
            <p className="min-w-0 shrink font-semibold">
              <span className="pr-[0.6ch]">Size:</span>
              <span className="text-foreground bg-foreground/6 border-foreground/6 rounded-md border px-1.25">
                {formatGB(Number(values.capacityGb))}
              </span>
            </p>
          </div>
        )}
      />
      <div className="-mt-0.5 flex w-full flex-col gap-2">
        <div className="flex w-full">
          <form.AppField
            name="capacityGb"
            children={(field) => (
              <field.StorageSizeInput
                field={field}
                className="w-full px-1.5 py-2.25"
                onBlur={field.handleBlur}
                min={minStorageGb}
                max={maxStorageGb}
                step={storageStepGb}
                minMaxFormatter={formatGB}
                defaultValue={[minStorageGb]}
                value={field.state.value ? [Number(field.state.value)] : undefined}
                onValueChange={(value) => {
                  field.handleChange(value[0]);
                }}
              />
            )}
          />
        </div>
        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            capacityGb: state.values.capacityGb,
            isSubmitting: state.isSubmitting,
          })}
          children={({ canSubmit, capacityGb }) => {
            const isCapacityUnchanged = capacityGb === currentCapacityGb;
            return (
              <div
                data-disabled={isCapacityUnchanged ? true : undefined}
                className="flex max-w-full flex-wrap gap-2"
              >
                <Button
                  disabled={!canSubmit || isCapacityUnchanged}
                  onClick={() => {
                    form.setFieldValue("capacityGb", currentCapacityGb);
                    form.validate("change");
                  }}
                  variant="outline"
                  type="button"
                  className="group/button max-w-full px-3 py-1.75"
                >
                  <RotateCcwIcon className="-ml-0.5 size-4.5 transition-transform group-disabled/button:-rotate-90" />
                  <span className="min-w-0 shrink truncate">Undo</span>
                </Button>
                <ExpandDialogTrigger newCapacityGb={capacityGb} volume={volume}>
                  <Button
                    disabled={!canSubmit || isCapacityUnchanged}
                    className="max-w-full truncate px-3 py-1.75"
                    type="button"
                  >
                    <ScalingIcon className="-ml-0.5 size-4.5" />
                    <p className="min-w-0 shrink truncate">Expand</p>
                  </Button>
                </ExpandDialogTrigger>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

function ExpandDialogTrigger({
  newCapacityGb,
  volume,
  children,
}: {
  newCapacityGb: number;
  volume: TVolumeShallow;
  children: ReactNode;
}) {
  const { teamId, projectId, environmentId } = useServices();
  const { invalidate: invalidateServices } = useServicesUtils({ teamId, projectId, environmentId });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const textToConfirm = "I want to expand this volume";

  const type: TVolumeType = "environment";

  const {
    mutateAsync: expandVolume,
    error,
    reset,
  } = api.storage.volumes.expand.useMutation({
    onSuccess: async () => {
      const result = await ResultAsync.fromPromise(
        Promise.all([invalidateServices()]),
        () => new Error("Expand success callback failed"),
      );

      if (result.isErr()) {
        toast.error("Data refetch failed", {
          description:
            "Expand was successful, but couldn't fetch the new data. Refresh the page to see the changes.",
        });
      }

      setIsDialogOpen(false);

      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => {
        form.reset();
        reset();
      }, defaultAnimationMs);
    },
  });

  const timeout = useRef<NodeJS.Timeout | null>(null);

  const form = useAppForm({
    defaultValues: {
      textToConfirm: "",
    },
    validators: {
      onChange: z
        .object({
          textToConfirm: z.string().refine((v) => v === textToConfirm, {
            message: "Please type the correct text to confirm",
          }),
        })
        .strip(),
    },
    onSubmit: async () => {
      await expandVolume({
        id: volume.id,
        capacityGb: newCapacityGb,
        type,
        teamId,
        projectId,
        environmentId,
      });
    },
  });

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(o) => {
        setIsDialogOpen(o);
        if (!o) {
          if (timeout.current) clearTimeout(timeout.current);
          timeout.current = setTimeout(() => {
            form.reset();
            reset();
          }, defaultAnimationMs);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>
            <span className="pr-[0.5ch]">Expand to:</span>
            <span className="text-foreground bg-foreground/6 border-foreground/6 max-w-full rounded-md border px-1.25 leading-tight font-semibold">
              {formatGB(Number(newCapacityGb))}
            </span>
          </DialogTitle>
          <DialogDescription>
            Proceed with caution:{" "}
            <span className="text-warning font-semibold">
              The volume size can never be reduced!
            </span>{" "}
            Whenever possible, expand the volume in small increments.
            <br />
            <br />
            Type {`"`}
            <span className="text-warning font-semibold">{textToConfirm}</span>
            {`"`} to confirm.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="group/form flex flex-col"
        >
          <form.AppField
            name="textToConfirm"
            children={(field) => (
              <field.TextField
                hideInfo
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full"
                placeholder={textToConfirm}
              />
            )}
          />
          <div className="mt-4 flex w-full flex-col gap-4">
            {error && <ErrorLine message={error?.message} />}
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <DialogClose asChild className="text-muted-foreground">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <form.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                  values: state.values,
                })}
                children={({ canSubmit, isSubmitting, values }) => (
                  <form.SubmitButton
                    data-submitting={isSubmitting ? true : undefined}
                    variant="warning"
                    disabled={!canSubmit || values.textToConfirm !== textToConfirm}
                    isPending={isSubmitting ? true : false}
                  >
                    Expand
                  </form.SubmitButton>
                )}
              />
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
