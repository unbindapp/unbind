import ErrorLine from "@/components/error-line";
import { useSystem } from "@/components/system/system-provider";
import { Button } from "@/components/ui/button";
import { formatGB } from "@/lib/helpers/format-gb";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TVolumeShallow } from "@/server/trpc/api/services/types";
import { RotateCcwIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

type TProps = {
  volume: TVolumeShallow;
};

const volumeMaxStorageGb = 200;

export default function ResizeSection({ volume }: TProps) {
  const { data: systemData, isPending: isPendingSystem, error: errorSystem } = useSystem();

  const minStorageGb = useMemo(() => volume.size_gb || 1, [volume.size_gb]);
  const maxStorageGb = useMemo(
    () => Math.min(volumeMaxStorageGb, systemData?.data.storage.maximum_storage_gb || 100),
    [systemData],
  );
  const storageStepGb = useMemo(() => systemData?.data.storage.storage_step_gb || 1, [systemData]);
  const currentSizeGb = volume.size_gb?.toString() || "1";

  const form = useAppForm({
    defaultValues: {
      sizeGb: minStorageGb.toString(),
    },
    validators: {
      onChange: ({ value }) => {
        if (value.sizeGb === minStorageGb.toString()) {
          return "Volume size cannot be less than the current size.";
        }
        return undefined;
      },
    },
    onSubmit: async () => {
      toast.info("Resizing volume...");
    },
  });

  const isPending = isPendingSystem;
  const error = errorSystem;
  const hasData = systemData !== undefined;

  if (!hasData && isPending) {
    return (
      <div className="flex w-full flex-col gap-2.5 text-transparent">
        <div className="flex w-full justify-start px-1.5">
          <p className="bg-muted-foreground animate-skeleton max-w-full rounded-md leading-tight">
            Loading the details of the volume...
          </p>
        </div>
        <div className="flex w-full justify-start px-1.5">
          <p className="bg-foreground animate-skeleton max-w-full rounded-md leading-tight">
            Size: 10GB
          </p>
        </div>
        <div className="animate-skeleton -mt-0.5 flex w-full items-center gap-3 px-1.5 py-2.25 text-xs leading-tight md:max-w-xl">
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

  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="flex w-full justify-start px-1.5">
        <p className="text-muted-foreground leading-tight">
          Resize the volume. Volumes can never be downsized.
        </p>
      </div>
      <form.Subscribe
        selector={(state) => [state.values]}
        children={([values]) => (
          <div className="flex w-full justify-start px-1.5">
            <p className="min-w-0 shrink leading-tight font-semibold">
              <span className="pr-[0.6ch]">Size:</span>
              <span className="text-foreground bg-foreground/6 border-foreground/6 rounded-md border px-1.25">
                {formatGB(Number(values.sizeGb))}
              </span>
            </p>
          </div>
        )}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="-mt-0.5 flex w-full flex-col gap-2 lg:flex-row lg:items-center"
      >
        <div className="flex w-full md:max-w-xl">
          <form.AppField
            name="sizeGb"
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
                  field.handleChange(String(value[0]));
                }}
              />
            )}
          />
        </div>
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.values.sizeGb]}
          children={([canSubmit, sizeGb]) => {
            return (
              <div
                data-disabled={!canSubmit || sizeGb === currentSizeGb ? true : undefined}
                className="flex max-w-full flex-wrap gap-2 data-disabled:hidden lg:data-disabled:flex lg:data-disabled:opacity-0"
              >
                <Button
                  disabled={!canSubmit}
                  onClick={() => {
                    form.setFieldValue("sizeGb", currentSizeGb);
                    form.validate("change");
                  }}
                  variant="outline"
                  type="button"
                  className="max-w-full px-4 py-1.75 lg:px-2.5 lg:py-1.75"
                >
                  <RotateCcwIcon className="hidden size-4 lg:block" />
                  <span className="min-w-0 shrink truncate lg:hidden">Cancel</span>
                </Button>
                <Button
                  disabled={!canSubmit}
                  className="max-w-full truncate px-4 py-1.75 lg:max-w-40"
                  type="button"
                >
                  Resize
                </Button>
              </div>
            );
          }}
        ></form.Subscribe>
      </form>
    </div>
  );
}
