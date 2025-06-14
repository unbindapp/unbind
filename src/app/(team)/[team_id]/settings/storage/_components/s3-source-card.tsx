"use client";

import ErrorLine from "@/components/error-line";
import { NewEntityIndicator } from "@/components/new-entity-indicator";
import { useS3SourcesUtils } from "@/components/storage/s3-sources-provider";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import RenameEntityTrigger from "@/components/triggers/rename-entity-trigger";
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
  S3SourceNameSchema,
  TS3SourceShallow,
} from "@/server/trpc/api/storage/s3/types";
import { api } from "@/server/trpc/setup/client";
import {
  CylinderIcon,
  EllipsisVerticalIcon,
  PenIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { ResultAsync } from "neverthrow";
import {
  FC,
  HTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";
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

const bucketsPlaceholder = Array.from({ length: 3 }, (_, i) => i);

export default function S3SourceCard({ s3Source, teamId, isPlaceholder }: TProps) {
  return (
    <li className="relative w-full p-1 md:max-w-3xl">
      <div
        data-pending={isPlaceholder ? true : undefined}
        className="group/item relative flex w-full items-center justify-start"
      >
        <S3SourceDialogConditional s3Source={s3Source} teamId={teamId}>
          <Button
            disabled={isPlaceholder}
            fadeOnDisabled={false}
            variant="outline-muted"
            className="has-hover:group-hover/item:bg-background-hover flex w-full flex-col items-start justify-start gap-2.5 py-3 pr-12 pl-4 font-medium"
          >
            {s3Source && <NewEntityIndicator id={s3Source.id} />}
            <p className="group-data-pending/item:bg-foreground group-data-pending/item:animate-skeleton min-w-0 shrink truncate leading-tight font-semibold group-data-pending/item:rounded-md group-data-pending/item:text-transparent">
              {isPlaceholder ? "Loading" : s3Source.name}
            </p>
            <div className="-mx-2 -my-1 flex w-[calc(100%+1rem)] flex-row flex-wrap overflow-hidden">
              {isPlaceholder ? (
                bucketsPlaceholder.map((i) => (
                  <Bucket key={i} name={`Loading ${i}`} isPlaceholder={true} />
                ))
              ) : s3Source.buckets.length === 0 ? (
                <Bucket
                  name="No buckets available"
                  Icon={XIcon}
                  classNameParagraph="whitespace-normal"
                  className="max-w-full sm:max-w-full md:max-w-full lg:max-w-full"
                />
              ) : (
                s3Source.buckets.map((b) => (
                  <Bucket key={`${s3Source.id}/${b.name}`} name={b.name} />
                ))
              )}
            </div>
          </Button>
        </S3SourceDialogConditional>
        <div className="absolute top-1.25 right-1.25 size-9">
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

function S3SourceDialogConditional({
  s3Source,
  teamId,
  children,
}: {
  children: ReactNode;
  teamId: string | undefined;
  s3Source: TS3SourceShallow | undefined;
}) {
  if (!s3Source || !teamId) {
    return children;
  }
  return (
    <S3SourceDialog s3Source={s3Source} teamId={teamId}>
      {children}
    </S3SourceDialog>
  );
}

function S3SourceDialog({
  s3Source,
  teamId,
  children,
}: {
  s3Source: TS3SourceShallow;
  teamId: string;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent hideXButton className="p-0" classNameInnerWrapper="w-128 max-w-full gap-0">
        <DialogHeader className="px-5 py-3.5">
          <DialogTitle className="sr-only">{s3Source.name}</DialogTitle>
          <RenameTrigger s3Source={s3Source} teamId={teamId} closeDropdown={() => null}>
            <Button
              variant="ghost"
              className="group/button -my-1 -ml-2.5 flex min-w-0 shrink items-center justify-start gap-1.5 rounded-md px-2.5 py-1"
            >
              <p className="min-w-0 shrink text-left text-xl leading-tight">{s3Source.name}</p>
              <PenIcon className="ml-0.5 size-4 -rotate-30 opacity-0 transition group-focus-visible/button:rotate-0 group-focus-visible/button:opacity-100 group-active/button:rotate-0 group-active/button:opacity-100 has-hover:group-hover/button:rotate-0 has-hover:group-hover/button:opacity-100 sm:size-4.5" />
            </Button>
          </RenameTrigger>
        </DialogHeader>
        <S3SourceDialogInnerContent
          s3Source={s3Source}
          teamId={teamId}
          closeDropdown={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function S3SourceDialogInnerContent({
  s3Source,
  teamId,
}: {
  s3Source: TS3SourceShallow;
  teamId: string;
  closeDropdown: () => void;
}) {
  const { data, isPending, error } = api.storage.s3.test.useQuery({
    accessKeyId: s3Source.access_key,
    secretKey: s3Source.secret_key,
    endpoint: s3Source.endpoint,
    region: s3Source.region,
  });

  const { connectionStatusString, connectionStatus } = useMemo(() => {
    if (data && data.data.valid) {
      return {
        connectionStatusString: "Connected successfully",
        connectionStatus: "connected",
      };
    }
    if (data && !data.data.valid) {
      return {
        connectionStatusString:
          "Connection failed" + (data.data.error ? `: ${data.data.error}` : ""),
        connectionStatus: "error",
      };
    }
    if (isPending) {
      return {
        connectionStatusString: "Testing connection...",
        connectionStatus: "pending",
      };
    }
    if (error) {
      return {
        connectionStatusString: "Connection failed" + (error.message ? `: ${error.message}` : ""),
        connectionStatus: "error",
      };
    }
    return {
      connectionStatusString: "Connection failed: Unknown error",
      connectionStatus: "error",
    };
  }, [data, isPending, error]);

  return (
    <>
      <div
        data-status={connectionStatus}
        className="group/status bg-foreground/6 border-foreground/6 data-[status=pending]:border-warning/8 data-[status=pending]:bg-warning/8 data-[status=connected]:bg-success/8 data-[status=connected]:border-success/8 data-[status=error]:bg-destructive/8 data-[status=error]:border-destructive/8 flex w-full items-start justify-start gap-2 border-t border-b px-5 py-2 text-sm leading-tight font-medium"
      >
        <div className="bg-foreground group-data-[status=connected]/status:bg-success group-data-[status=error]/status:bg-destructive group-data-[status=pending]/status:bg-warning mt-[0.2rem] size-2.5 shrink-0 rounded-full group-data-[status=pending]/status:animate-ping" />
        <p className="group-data-[status=connected]/status:text-success group-data-[status=error]/status:text-destructive group-data-[status=pending]/status:text-warning min-w-0 shrink">
          {connectionStatusString}
        </p>
      </div>
      <div className="flex w-full flex-col gap-3 px-5 pt-3.5 pb-5.5">
        <div className="flex w-full">
          <h3 className="w-full text-lg leading-tight font-semibold">
            Buckets{" "}
            <span className="text-muted-foreground font-normal">
              ({s3Source.buckets.length})
            </span>{" "}
          </h3>
        </div>
        <ol className="-mx-2 -my-1 flex w-[calc(100%+1rem)] flex-wrap items-start justify-start">
          {s3Source.buckets.length === 0 ? (
            <li className="w-full p-0.75 sm:w-1/2">
              <Bucket
                name="No buckets available"
                Icon={XIcon}
                className="text-foreground md:w-w-full lg:w-w-full w-full max-w-full items-start justify-start gap-1.75 rounded-md border px-3 py-3 text-sm leading-tight sm:w-full sm:max-w-full md:max-w-full lg:max-w-full"
                classNameParagraph="whitespace-normal font-medium -mt-0.75"
                classNameIcon="size-3.5"
              />
            </li>
          ) : (
            s3Source.buckets.map((bucket) => (
              <li key={`${s3Source.id}/${bucket.name}`} className="w-full p-0.75 sm:w-1/2">
                <Bucket
                  name={bucket.name}
                  className="text-foreground md:w-w-full lg:w-w-full w-full max-w-full items-start justify-start gap-1.75 rounded-md border px-3 py-3 text-sm leading-tight sm:w-full sm:max-w-full md:max-w-full lg:max-w-full"
                  classNameParagraph="whitespace-normal font-medium -mt-0.75"
                  classNameIcon="size-3.5"
                />
              </li>
            ))
          )}
        </ol>
      </div>
      <div className="bg-border h-px w-full" />
      <div className="flex w-full items-center justify-between px-1 py-2">
        <div className="max-w-1/2 px-1">
          <DeleteTrigger s3Source={s3Source} teamId={teamId} closeDropdown={() => {}}>
            <Button variant="ghost-destructive" className="w-full px-4">
              <Trash2Icon className="-ml-0.75 size-4.5" />
              <p className="min-w-0 shrink">Delete</p>
            </Button>
          </DeleteTrigger>
        </div>
        <div className="max-w-1/2 px-1">
          <DialogClose asChild>
            <Button variant="ghost" className="text-muted-foreground px-4">
              Close
            </Button>
          </DialogClose>
        </div>
      </div>
    </>
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
            <RenameTrigger
              s3Source={s3Source}
              teamId={teamId}
              closeDropdown={() => setIsOpen(false)}
            >
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <PenIcon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Rename</p>
              </DropdownMenuItem>
            </RenameTrigger>
            <DeleteTrigger
              teamId={teamId}
              s3Source={s3Source}
              closeDropdown={() => setIsOpen(false)}
            >
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive active:bg-destructive/10 data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
              >
                <Trash2Icon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Delete</p>
              </DropdownMenuItem>
            </DeleteTrigger>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Bucket({
  name,
  isPlaceholder,
  Icon = CylinderIcon,
  classNameParagraph,
  classNameIcon,
  className,
}: {
  name: string;
  isPlaceholder?: boolean;
  Icon?: FC<{ className?: string }>;
  classNameParagraph?: string;
  classNameIcon?: string;
  className?: string;
}) {
  return (
    <div
      data-placeholder={isPlaceholder ? true : undefined}
      className={cn(
        "group/card text-muted-foreground flex max-w-1/2 items-center justify-start gap-1.25 px-2 py-1 text-left text-xs leading-tight font-normal data-placeholder:text-transparent sm:max-w-1/3 md:max-w-1/2 lg:max-w-1/3",
        className,
      )}
    >
      <Icon
        className={cn(
          "group-data-placeholder/card:bg-muted-foreground group-data-placeholder/card:animate-skeleton size-3.5 shrink-0 group-data-placeholder/card:rounded-full",
          classNameIcon,
        )}
      />
      <p
        className={cn(
          "group-data-placeholder/card:bg-muted-foreground group-data-placeholder/card:animate-skeleton min-w-0 shrink truncate group-data-placeholder/card:rounded",
          classNameParagraph,
        )}
      >
        {name}
      </p>
    </div>
  );
}

const RenameSchema = z.object({
  name: S3SourceNameSchema,
  description: z.string(),
});

function RenameTrigger({
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
  const {
    mutateAsync: updateS3Source,
    error: updateS3SourceError,
    reset: updateS3SourceReset,
  } = api.storage.s3.update.useMutation();

  const { invalidate: invalidateS3Sources } = useS3SourcesUtils({ teamId });

  return (
    <RenameEntityTrigger
      type="name-only"
      name={s3Source.name}
      nameInputTitle="Source Name"
      dialogTitle="Rename S3 Source"
      dialogDescription="Give a new name to the S3 source."
      error={updateS3SourceError}
      formSchema={RenameSchema}
      onDialogClose={() => {
        updateS3SourceReset();
      }}
      onDialogCloseImmediate={() => {
        closeDropdown();
      }}
      onSubmit={async (value) => {
        await updateS3Source({
          id: s3Source.id,
          name: value.name,
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
      }}
    >
      {children}
    </RenameEntityTrigger>
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
  const { invalidate: invalidateS3Sources } = useS3SourcesUtils({ teamId });

  const {
    mutateAsync: deleteS3Source,
    error: deleteS3SourceError,
    reset: deleteS3SourceReset,
  } = api.storage.s3.delete.useMutation();

  return (
    <DeleteEntityTrigger
      dialogTitle="Delete S3 Source"
      dialogDescription="Are you sure you want to delete this S3 source? This action cannot be undone. Services depending on this S3 source will have to be reconfigured."
      deletingEntityName={s3Source.name}
      error={deleteS3SourceError}
      onDialogClose={() => {
        deleteS3SourceReset();
      }}
      onDialogCloseImmediate={() => {
        closeDropdown();
      }}
      onSubmit={async () => {
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
      }}
    >
      {children}
    </DeleteEntityTrigger>
  );
}

export function NewS3SourceCard({ teamId }: { teamId: string }) {
  return (
    <NewS3SourceTrigger teamId={teamId}>
      <li className="relative w-full p-1 md:max-w-3xl">
        <div className="group/item relative flex w-full items-center justify-start">
          <Button
            variant="outline"
            className="text-muted-foreground flex w-full flex-row items-center justify-start px-4 py-3.25 font-medium"
          >
            <PlusIcon className="-my-1 -ml-1 size-4.5 shrink-0" />
            <p className="group-data-pending/item:bg-foreground group-data-pending/item:animate-skeleton min-w-0 shrink truncate leading-tight group-data-pending/item:rounded-md group-data-pending/item:text-transparent">
              New S3 Source
            </p>
          </Button>
        </div>
      </li>
    </NewS3SourceTrigger>
  );
}

export function NewS3SourceTrigger({ teamId, children }: { children: ReactNode; teamId: string }) {
  const { invalidate: invalidateS3Sources } = useS3SourcesUtils({ teamId });
  const {
    mutateAsync: createS3Source,
    error: createS3SourceError,
    reset: createS3SourceReset,
  } = api.storage.s3.create.useMutation({});

  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();

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
      const res = await createS3Source({
        name: value.name,
        accessKeyId: value.accessKeyId,
        endpoint: value.endpoint,
        region: value.region,
        secretKey: value.secretKey,
        teamId,
      });

      temporarilyAddNewEntity(res.data.id);

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
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>Create S3 Source</DialogTitle>
          <DialogDescription>
            Give a name to the new S3 source. Sources can have multiple buckets in them. They can be
            used for backups.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit(e);
          }}
          className="flex w-full flex-col gap-4"
        >
          <div className="flex w-full flex-col gap-4">
            <InputWrapper>
              <Label htmlFor="name">Name</Label>
              <form.AppField
                name="name"
                children={(field) => (
                  <field.TextField
                    id="name"
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
            </InputWrapper>
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-0">
              <InputWrapper className="w-full sm:w-2/3 sm:pr-4">
                <Label htmlFor="endpoint">Endpoint</Label>
                <form.AppField
                  name="endpoint"
                  children={(field) => (
                    <field.TextField
                      id="endpoint"
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
              </InputWrapper>
              <InputWrapper className="w-full sm:w-1/3">
                <Label htmlFor="region">Region</Label>
                <form.AppField
                  name="region"
                  children={(field) => (
                    <field.TextField
                      id="region"
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
              </InputWrapper>
            </div>
            <InputWrapper>
              <Label htmlFor="accessKeyId">Access Key ID</Label>
              <form.AppField
                name="accessKeyId"
                children={(field) => (
                  <field.TextField
                    id="accessKeyId"
                    placeholder="AWS_ACCESS_KEY_ID"
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
            </InputWrapper>
            <InputWrapper>
              <Label htmlFor="secretKey">Secret Access Key</Label>
              <form.AppField
                name="secretKey"
                children={(field) => (
                  <field.TextField
                    id="secretKey"
                    placeholder="AWS_SECRET_ACCESS_KEY"
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
            </InputWrapper>
          </div>
          {createS3SourceError && (
            <ErrorLine className="mt-2" message={createS3SourceError?.message} />
          )}
          <div className="mt-2 flex w-full flex-wrap items-center justify-end gap-2">
            <DialogClose asChild className="text-muted-foreground">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <form.Subscribe
              selector={(state) => ({ isSubmitting: state.isSubmitting })}
              children={({ isSubmitting }) => (
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

function Label({ children, className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label {...rest} className={cn("max-w-full px-1.5 leading-tight font-medium", className)}>
      {children}
    </label>
  );
}

function InputWrapper({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex w-full flex-col items-start gap-2", className)} {...rest}>
      {children}
    </div>
  );
}
