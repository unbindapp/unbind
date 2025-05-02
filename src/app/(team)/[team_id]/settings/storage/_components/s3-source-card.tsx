"use client";

import ErrorLine from "@/components/error-line";
import { useS3SourcesUtils } from "@/components/storage/s3-sources-provider";
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
import { defaultAnimationMs } from "@/lib/constants";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  CreateS3SourceFormSchema,
  s3SourceNameMaxLength,
  TS3SourceShallow,
} from "@/server/trpc/api/storage/s3/types";
import { api } from "@/server/trpc/setup/client";
import { EllipsisVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

type TProps =
  | {
      isPlaceholder: true;
      s3Source?: never;
      teamId?: never;
    }
  | {
      isPlaceholder?: never;
      s3Source: TS3SourceShallow;
      teamId: string;
    };

export default function S3SourceCard({ s3Source, teamId, isPlaceholder }: TProps) {
  return (
    <li className="relative w-full p-1 sm:w-1/2">
      <div
        data-pending={isPlaceholder ? true : undefined}
        className="group/item relative flex w-full items-center justify-start"
      >
        <Button
          disabled={isPlaceholder}
          fadeOnDisabled={false}
          variant="outline-muted"
          className="has-hover:group-hover/item:bg-background-hover flex w-full flex-row items-center justify-start gap-2.5 py-3 pr-12 pl-4 font-medium"
        >
          <p className="group-data-pending/item:bg-foreground group-data-pending/item:animate-skeleton min-w-0 shrink truncate leading-tight group-data-pending/item:rounded-md group-data-pending/item:text-transparent">
            {isPlaceholder ? "Loading" : s3Source.name}
          </p>
        </Button>
        <div className="absolute top-1/2 right-1.25 size-9 -translate-y-1/2">
          {isPlaceholder ? (
            <div className="flex size-full items-center justify-center">
              <div className="bg-muted-more-foreground animate-skeleton size-6 rounded-md" />
            </div>
          ) : (
            <ThreeDotButton className="size-full" s3Source={s3Source} teamId={teamId} />
          )}
        </div>
      </div>
    </li>
  );
}

function ThreeDotButton({
  s3Source,
  teamId,
  className,
}: {
  s3Source: TS3SourceShallow;
  teamId: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          data-open={isOpen ? true : undefined}
          fadeOnDisabled={false}
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-more-foreground group/button rounded-md group-data-placeholder/card:text-transparent",
            className,
          )}
        >
          <EllipsisVerticalIcon className="size-6 transition-transform group-data-open/button:rotate-90" />
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
            <DeleteTrigger
              teamId={teamId}
              s3Source={s3Source}
              closeDropdown={() => setIsOpen(false)}
            >
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive active:bg-destructive/10 data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
              >
                <TrashIcon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Delete</p>
              </DropdownMenuItem>
            </DeleteTrigger>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteTrigger({
  s3Source,
  teamId,
  closeDropdown,
  children,
}: {
  s3Source: TS3SourceShallow;
  teamId: string;
  closeDropdown: () => void;
  children: ReactNode;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const textToConfirm = `Delete ${s3Source.name} permanently`;

  const { invalidate: invalidateS3Sources } = useS3SourcesUtils({ teamId });

  const {
    mutateAsync: deleteS3Source,
    error: deleteS3SourceError,
    reset: deleteS3SourceReset,
  } = api.storage.s3.delete.useMutation();

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
    onSubmit: async ({ formApi }) => {
      await deleteS3Source({
        id: s3Source.id,
        teamId,
      });

      const invalidateRes = await ResultAsync.fromPromise(
        invalidateS3Sources(),
        () => new Error("Failed to fetch S3 sources"),
      );

      if (invalidateRes.isErr()) {
        toast.error("Failed to fetch S3 sources", {
          description: invalidateRes.error.message,
        });
      }
      formApi.reset();
      closeDropdown();
    },
  });

  const timeout = useRef<NodeJS.Timeout>(undefined);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(o) => {
        setIsDialogOpen(o);
        if (!o) {
          closeDropdown();
          if (timeout.current) clearTimeout(timeout.current);
          timeout.current = setTimeout(() => {
            form.reset();
            deleteS3SourceReset();
          }, defaultAnimationMs);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>Delete S3 Source</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this S3 source? This action cannot be undone. Services
            depending on this S3 source will have to be reconfigured.
            <br />
            <br />
            Type {`"`}
            <span className="text-destructive font-semibold">{textToConfirm}</span>
            {`"`} to confirm.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="flex flex-col"
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
          {deleteS3SourceError && (
            <ErrorLine message={deleteS3SourceError?.message} className="mt-4" />
          )}
          <div className="mt-4 flex w-full flex-wrap items-center justify-end gap-2">
            <DialogClose asChild className="text-muted-foreground">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting, state.values]}
              children={([canSubmit, isSubmitting, values]) => (
                <form.SubmitButton
                  data-submitting={isSubmitting ? true : undefined}
                  variant="destructive"
                  disabled={
                    !canSubmit ||
                    (typeof values === "object" && values.textToConfirm !== textToConfirm)
                  }
                  isPending={isSubmitting ? true : false}
                >
                  Delete
                </form.SubmitButton>
              )}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewS3SourceCard({ teamId }: { teamId: string }) {
  const { invalidate: invalidateS3Sources } = useS3SourcesUtils({ teamId });
  const {
    mutateAsync: createS3Source,
    error: createS3SourceError,
    reset: createS3SourceReset,
  } = api.storage.s3.create.useMutation({});

  const [open, setOpen] = useState(false);

  const form = useAppForm({
    defaultValues: {
      name: "",
      accessKeyId: "",
      endpoint: "",
      region: "",
      secretKey: "",
    },
    validators: {
      onChange: CreateS3SourceFormSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      await createS3Source({
        name: value.name,
        accessKeyId: value.accessKeyId,
        endpoint: value.endpoint,
        region: value.region,
        secretKey: value.secretKey,
        teamId,
      });

      const invalidateRes = await ResultAsync.fromPromise(
        invalidateS3Sources(),
        () => new Error("Failed to fetch S3 sources"),
      );

      if (invalidateRes.isErr()) {
        toast.error("Failed to fetch environments", {
          description: invalidateRes.error.message,
        });
      }

      setOpen(false);
      formApi.reset();
    },
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            form.reset();
            createS3SourceReset();
          }, defaultAnimationMs);
        }
      }}
    >
      <DialogTrigger asChild>
        <li className="relative w-full p-1 sm:w-1/2">
          <div className="group/item relative flex w-full items-center justify-start">
            <Button
              variant="outline"
              className="text-muted-foreground flex w-full flex-row items-center justify-start px-4 py-3 font-medium"
            >
              <PlusIcon className="-my-1 -ml-1 size-4.5 shrink-0" />
              <p className="group-data-pending/item:bg-foreground group-data-pending/item:animate-skeleton min-w-0 shrink truncate leading-tight group-data-pending/item:rounded-md group-data-pending/item:text-transparent">
                New S3 Source
              </p>
            </Button>
          </div>
        </li>
      </DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>Create S3 Source</DialogTitle>
          <DialogDescription>Give a name to the new S3 source.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="flex w-full flex-col gap-4"
        >
          <div className="flex w-full flex-col gap-2">
            <form.AppField
              name="name"
              children={(field) => (
                <field.TextField
                  placeholder="Main S3 Source"
                  autoCapitalize="none"
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full"
                  maxLength={s3SourceNameMaxLength}
                />
              )}
            />
            <form.AppField
              name="endpoint"
              children={(field) => (
                <field.TextField
                  placeholder="https://s3.amazonaws.com"
                  autoCapitalize="none"
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full"
                />
              )}
            />
            <form.AppField
              name="region"
              children={(field) => (
                <field.TextField
                  placeholder="us-east-1"
                  autoCapitalize="none"
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full"
                />
              )}
            />
            <form.AppField
              name="accessKeyId"
              children={(field) => (
                <field.TextField
                  placeholder="YOUR_ACCESS_KEY_ID"
                  autoCapitalize="none"
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full"
                />
              )}
            />
            <form.AppField
              name="secretKey"
              children={(field) => (
                <field.TextField
                  placeholder="YOUR_SECRET_ACCESS_KEY"
                  autoCapitalize="none"
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full"
                />
              )}
            />
          </div>
          {createS3SourceError && <ErrorLine message={createS3SourceError?.message} />}
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <DialogClose asChild className="text-muted-foreground">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <form.Subscribe
              selector={(state) => [state.isSubmitting]}
              children={([isSubmitting]) => (
                <form.SubmitButton
                  data-submitting={isSubmitting ? true : undefined}
                  isPending={isSubmitting ? true : false}
                >
                  Create
                </form.SubmitButton>
              )}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
