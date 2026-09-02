"use client";

import ErrorLine from "@/components/error-line";
import { NewEntityIndicator } from "@/components/new-entity-indicator";
import { useS3BucketsUtils } from "@/components/storage/s3-buckets-provider";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import RenameEntityTrigger from "@/components/triggers/rename-entity-trigger";
import { Button } from "@/components/ui/button";
import {
  createDialogHandle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  TDialogHandle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { defaultAnimationMs } from "@/lib/constants";
import {
  removeFormDraft,
  TFormPersistenceProps,
  useAppFormWithPersistence,
} from "@/lib/hooks/use-app-form-with-persistence";
import {
  createS3Bucket as createS3BucketFn,
  CreateS3BucketFormSchema,
  deleteS3Bucket as deleteS3BucketFn,
  EditS3BucketFormSchema,
  s3BucketNameMaxLength,
  S3BucketNameSchema,
  testS3Query,
  TS3BucketFormValues,
  TS3BucketShallow,
  TUpdateS3BucketInput,
  updateS3Bucket as updateS3BucketFn,
} from "@/lib/queries/storage";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CylinderIcon,
  EllipsisVerticalIcon,
  GlobeIcon,
  PenIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";
import { ResultAsync } from "neverthrow";
import {
  FC,
  HTMLAttributes,
  LabelHTMLAttributes,
  ReactElement,
  useMemo,
  useRef,
  useState,
} from "react";
import { z } from "zod";

type TProps =
  | {
      isPlaceholder: true;
      s3Bucket?: never;
      teamId?: never;
    }
  | {
      isPlaceholder?: never;
      s3Bucket: TS3BucketShallow;
      teamId: string;
    };

export default function S3BucketCard({ s3Bucket, teamId, isPlaceholder }: TProps) {
  return (
    <li className="relative w-full p-1 md:max-w-3xl">
      <div
        data-pending={isPlaceholder || undefined}
        className="group/item relative flex w-full items-center justify-start"
      >
        <S3BucketDialogConditional s3Bucket={s3Bucket} teamId={teamId}>
          <Button
            disabled={isPlaceholder}
            fadeOnDisabled={false}
            variant="outline"
            className="bg-card flex w-full flex-col items-start justify-start gap-2.5 py-3 pr-12 pl-4 font-medium"
          >
            {s3Bucket && <NewEntityIndicator id={s3Bucket.id} />}
            <p className="group-data-pending/item:bg-foreground group-data-pending/item:animate-skeleton min-w-0 shrink truncate leading-tight font-semibold group-data-pending/item:rounded-md group-data-pending/item:text-transparent">
              {isPlaceholder ? "Loading" : s3Bucket.name}
            </p>
            <div className="-mx-2 -my-1 flex w-[calc(100%+1rem)] flex-row flex-wrap overflow-hidden">
              {isPlaceholder ? (
                <Chip name="Loading bucket" isPlaceholder={true} />
              ) : (
                <Chip name={s3Bucket.bucket} />
              )}
            </div>
          </Button>
        </S3BucketDialogConditional>
        <div className="absolute top-1.25 right-1.25 size-9">
          {isPlaceholder ? (
            <div className="flex size-full items-center justify-center">
              <div className="bg-muted-more-foreground animate-skeleton size-6 rounded-md" />
            </div>
          ) : (
            <ThreeDotButton className="size-full" s3Bucket={s3Bucket} teamId={teamId} />
          )}
        </div>
      </div>
    </li>
  );
}

function S3BucketDialogConditional({
  s3Bucket,
  teamId,
  children,
}: {
  children: ReactElement;
  teamId: string | undefined;
  s3Bucket: TS3BucketShallow | undefined;
}) {
  if (!s3Bucket || !teamId) {
    return children;
  }
  return (
    <S3BucketDialog s3Bucket={s3Bucket} teamId={teamId}>
      {children}
    </S3BucketDialog>
  );
}

function S3BucketDialog({
  s3Bucket,
  teamId,
  children,
}: {
  s3Bucket: TS3BucketShallow;
  teamId: string;
  children: ReactElement;
} & HTMLAttributes<HTMLDivElement>) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={children} />
      <DialogContent hideXButton className="p-0" classNameInnerWrapper="w-128 max-w-full gap-0">
        <DialogHeader className="px-5 py-3.5">
          <DialogTitle className="sr-only">{s3Bucket.name}</DialogTitle>
          <RenameTrigger s3Bucket={s3Bucket} teamId={teamId}>
            <Button
              variant="ghost"
              className="group/button -my-1 -ml-2.5 flex min-w-0 shrink items-center justify-start gap-1.5 rounded-md px-2.5 py-1"
            >
              <p className="min-w-0 shrink text-left text-xl leading-tight">{s3Bucket.name}</p>
              <PenIcon className="ml-0.5 size-4 -rotate-30 opacity-0 transition group-focus-visible/button:rotate-0 group-focus-visible/button:opacity-100 group-active/button:rotate-0 group-active/button:opacity-100 has-hover:group-hover/button:rotate-0 has-hover:group-hover/button:opacity-100 sm:size-4.5" />
            </Button>
          </RenameTrigger>
        </DialogHeader>
        <S3BucketDialogInnerContent s3Bucket={s3Bucket} />
      </DialogContent>
    </Dialog>
  );
}

function S3BucketDialogInnerContent({ s3Bucket }: { s3Bucket: TS3BucketShallow }) {
  const { data, isPending, error } = useQuery(
    testS3Query({
      endpoint: s3Bucket.endpoint,
      region: s3Bucket.region,
      bucket: s3Bucket.bucket,
      accessKeyId: s3Bucket.access_key,
      secretKey: s3Bucket.secret_key,
    }),
  );

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
        className="group/status bg-foreground/6 border-foreground/6 data-[status=pending]:border-warning/8 data-[status=pending]:bg-warning/8 data-[status=connected]:bg-success/8 data-[status=connected]:border-success/8 data-[status=error]:bg-destructive/8 data-[status=error]:border-destructive/8 flex w-full items-center justify-start gap-2 border-t border-b px-5 py-2 text-sm leading-tight font-medium"
      >
        <div className="bg-foreground group-data-[status=connected]/status:bg-success group-data-[status=error]/status:bg-destructive group-data-[status=pending]/status:bg-warning size-2 shrink-0 rounded-full group-data-[status=pending]/status:animate-ping" />
        <p className="group-data-[status=connected]/status:text-success group-data-[status=error]/status:text-destructive group-data-[status=pending]/status:text-warning min-w-0 shrink leading-tight">
          {connectionStatusString}
        </p>
      </div>
      <ol className="-mx-1 flex w-[calc(100%+0.5rem)] flex-wrap px-4.25 pt-3.5 pb-4">
        <Detail label="Bucket" value={s3Bucket.bucket} Icon={CylinderIcon} />
        <Detail label="Region" value={s3Bucket.region || "Not set"} />
        <Detail label="Endpoint" value={s3Bucket.endpoint} Icon={GlobeIcon} className="sm:w-full" />
        <Detail label="Access Key ID" value={s3Bucket.access_key} className="sm:w-full" />
      </ol>
      <div className="bg-border h-px w-full" />
      <div className="flex w-full items-center justify-end px-1 py-2">
        <div className="flex max-w-1/2 items-center justify-end px-1">
          <DialogClose
            render={
              <Button variant="ghost" className="px-4">
                Close
              </Button>
            }
          />
        </div>
      </div>
    </>
  );
}

function Detail({
  label,
  value,
  Icon,
  className,
}: {
  label: string;
  value: string;
  Icon?: FC<{ className?: string }>;
  className?: string;
}) {
  return (
    <li className={cn("w-full p-1 sm:w-1/2", className)}>
      <div className="flex w-full flex-col gap-1.5 rounded-lg border px-3 py-2.5">
        <p className="text-muted-foreground text-sm leading-tight font-normal">{label}</p>
        <div className="flex w-full items-center justify-start gap-2">
          {Icon && <Icon className="size-4 shrink-0" />}
          <p className="min-w-0 shrink leading-tight font-medium wrap-break-word">{value}</p>
        </div>
      </div>
    </li>
  );
}

function ThreeDotButton({
  s3Bucket,
  teamId,
  className,
}: {
  s3Bucket: TS3BucketShallow;
  teamId: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [renameHandle] = useState(() => createDialogHandle());
  const [editHandle] = useState(() => createDialogHandle());
  const [deleteHandle] = useState(() => createDialogHandle());

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              data-open={isOpen || undefined}
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
          }
        />
        <DropdownMenuContent
          className="z-50 w-40"
          sideOffset={-1}
          data-open={isOpen || undefined}
          align="end"
          keepMounted
        >
          <ScrollArea>
            <DropdownMenuGroup>
              {/* The dialogs live outside the menu; nested inside the open modal menu they would be inert */}
              <DialogTrigger
                nativeButton={false}
                handle={renameHandle}
                render={
                  <DropdownMenuItem>
                    <PenIcon className="-ml-0.5 size-5" />
                    <p className="min-w-0 shrink leading-tight">Rename</p>
                  </DropdownMenuItem>
                }
              />
              <DialogTrigger
                nativeButton={false}
                handle={editHandle}
                render={
                  <DropdownMenuItem>
                    <SettingsIcon className="-ml-0.5 size-5" />
                    <p className="min-w-0 shrink leading-tight">Edit</p>
                  </DropdownMenuItem>
                }
              />
              <DialogTrigger
                nativeButton={false}
                handle={deleteHandle}
                render={
                  <DropdownMenuItem className="text-destructive active:bg-destructive/10 data-highlighted:bg-destructive/10 data-highlighted:text-destructive">
                    <Trash2Icon className="-ml-0.5 size-5" />
                    <p className="min-w-0 shrink leading-tight">Delete</p>
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuGroup>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameTrigger s3Bucket={s3Bucket} teamId={teamId} handle={renameHandle} />
      <EditTrigger s3Bucket={s3Bucket} teamId={teamId} handle={editHandle} />
      <DeleteTrigger s3Bucket={s3Bucket} teamId={teamId} handle={deleteHandle} />
    </>
  );
}

function Chip({
  name,
  isPlaceholder,
  Icon = CylinderIcon,
  className,
}: {
  name: string;
  isPlaceholder?: boolean;
  Icon?: FC<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      data-placeholder={isPlaceholder || undefined}
      className={cn(
        "group/card text-muted-foreground flex max-w-1/2 items-center justify-start gap-1.25 px-2 py-1 text-left text-xs leading-tight font-normal data-placeholder:text-transparent sm:max-w-1/3 md:max-w-1/2 lg:max-w-1/3",
        className,
      )}
    >
      <Icon className="group-data-placeholder/card:bg-muted-foreground group-data-placeholder/card:animate-skeleton size-3.5 shrink-0 group-data-placeholder/card:rounded-full" />
      <p className="group-data-placeholder/card:bg-muted-foreground group-data-placeholder/card:animate-skeleton min-w-0 shrink truncate font-medium group-data-placeholder/card:rounded">
        {name}
      </p>
    </div>
  );
}

const RenameSchema = z.object({
  name: S3BucketNameSchema,
  description: z.string(),
});

function useInvalidateS3Buckets(teamId: string) {
  const { invalidate } = useS3BucketsUtils({ teamId });
  return async () => {
    const invalidateRes = await ResultAsync.fromPromise(
      invalidate(),
      () => new Error("Failed to fetch S3 buckets"),
    );

    if (invalidateRes.isErr()) {
      toast.add({
        type: "error",
        title: "Failed to fetch S3 buckets",
        description: invalidateRes.error.message,
      });
    }
  };
}

function RenameTrigger({
  s3Bucket,
  teamId,
  handle,
  children,
}: {
  s3Bucket: TS3BucketShallow;
  teamId: string;
  handle?: TDialogHandle;
  children?: ReactElement;
}) {
  const {
    mutateAsync: updateS3Bucket,
    error: updateS3BucketError,
    reset: updateS3BucketReset,
  } = useMutation({ mutationFn: updateS3BucketFn });

  const invalidateS3Buckets = useInvalidateS3Buckets(teamId);

  return (
    <RenameEntityTrigger
      type="name-only"
      name={s3Bucket.name}
      nameInputTitle="Bucket Name"
      dialogTitle="Rename S3 Bucket"
      dialogDescription="Give a new name to the S3 bucket."
      error={updateS3BucketError}
      formSchema={RenameSchema}
      handle={handle}
      onDialogClose={() => {
        updateS3BucketReset();
      }}
      onSubmit={async (value) => {
        await updateS3Bucket({
          id: s3Bucket.id,
          name: value.name,
          teamId,
        });
        await invalidateS3Buckets();
      }}
    >
      {children}
    </RenameEntityTrigger>
  );
}

function DeleteTrigger({
  s3Bucket,
  teamId,
  handle,
  children,
}: {
  s3Bucket: TS3BucketShallow;
  teamId: string;
  handle?: TDialogHandle;
  children?: ReactElement;
}) {
  const invalidateS3Buckets = useInvalidateS3Buckets(teamId);

  const {
    mutateAsync: deleteS3Bucket,
    error: deleteS3BucketError,
    reset: deleteS3BucketReset,
  } = useMutation({ mutationFn: deleteS3BucketFn });

  return (
    <DeleteEntityTrigger
      dialogTitle="Disconnect S3 Bucket"
      dialogDescription="Are you sure you want to disconnectthis S3 bucket? This action cannot be undone. Services backing up to this bucket will have their backups disabled."
      deletingEntityName={s3Bucket.name}
      error={deleteS3BucketError}
      textToConfirm={`Disconnect ${s3Bucket.name}`}
      handle={handle}
      submitButtonText="Disconnect"
      onDialogClose={() => {
        deleteS3BucketReset();
      }}
      onSubmit={async () => {
        await deleteS3Bucket({
          id: s3Bucket.id,
          teamId,
        });
        await invalidateS3Buckets();
      }}
    >
      {children}
    </DeleteEntityTrigger>
  );
}

function EditTrigger({
  s3Bucket,
  teamId,
  handle,
  children,
}: {
  s3Bucket: TS3BucketShallow;
  teamId: string;
  handle?: TDialogHandle;
  children?: ReactElement;
}) {
  const invalidateS3Buckets = useInvalidateS3Buckets(teamId);
  const {
    mutateAsync: updateS3Bucket,
    error: updateS3BucketError,
    reset: updateS3BucketReset,
  } = useMutation({ mutationFn: updateS3BucketFn });

  const [internalHandle] = useState(() => createDialogHandle());
  const dialogHandle = handle ?? internalHandle;

  return (
    <S3BucketFormDialog
      handle={dialogHandle}
      title="Edit S3 Bucket"
      description="Change the display name, bucket, endpoint, region or credentials."
      submitText="Save"
      schema={EditS3BucketFormSchema}
      accessKeyIdPlaceholder="Leave empty to keep the current key"
      secretKeyPlaceholder="Leave empty to keep the current key"
      defaultValues={{
        name: s3Bucket.name,
        endpoint: s3Bucket.endpoint,
        region: s3Bucket.region,
        bucket: s3Bucket.bucket,
        accessKeyId: "",
        secretKey: "",
      }}
      error={updateS3BucketError}
      resetError={updateS3BucketReset}
      onSubmit={async (value) => {
        const changes: TUpdateS3BucketInput = { id: s3Bucket.id, teamId };
        if (value.name !== s3Bucket.name) changes.name = value.name;
        if (value.endpoint !== s3Bucket.endpoint) changes.endpoint = value.endpoint;
        if (value.region !== s3Bucket.region) changes.region = value.region;
        if (value.bucket !== s3Bucket.bucket) changes.bucket = value.bucket;
        if (value.accessKeyId !== "") changes.accessKeyId = value.accessKeyId;
        if (value.secretKey !== "") changes.secretKey = value.secretKey;

        if (Object.keys(changes).length === 2) return;

        await updateS3Bucket(changes);
        await invalidateS3Buckets();
      }}
    >
      {children}
    </S3BucketFormDialog>
  );
}

export function AddS3BucketCard({ teamId }: { teamId: string }) {
  return (
    <AddS3BucketTrigger teamId={teamId}>
      <li className="relative w-full p-1 md:max-w-3xl">
        <div className="group/item relative flex w-full items-center justify-start">
          <Button
            variant="outline"
            className="text-muted-foreground flex w-full flex-row items-center justify-start px-4 py-3.25 font-medium"
          >
            <PlusIcon className="-my-1 -ml-1 size-4.5 shrink-0" />
            <p className="group-data-pending/item:bg-foreground group-data-pending/item:animate-skeleton min-w-0 shrink truncate leading-tight group-data-pending/item:rounded-md group-data-pending/item:text-transparent">
              Add S3 Bucket
            </p>
          </Button>
        </div>
      </li>
    </AddS3BucketTrigger>
  );
}

export function AddS3BucketTrigger({
  teamId,
  handle,
  children,
}: {
  children?: ReactElement;
  handle?: TDialogHandle;
  teamId: string;
}) {
  const invalidateS3Buckets = useInvalidateS3Buckets(teamId);
  const {
    mutateAsync: createS3Bucket,
    error: createS3BucketError,
    reset: createS3BucketReset,
  } = useMutation({ mutationFn: createS3BucketFn });

  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();

  const [internalHandle] = useState(() => createDialogHandle());
  const dialogHandle = handle ?? internalHandle;

  return (
    <S3BucketFormDialog
      handle={dialogHandle}
      title="Add S3 Bucket"
      description="Connect an S3-compatible bucket. It can be used for backups."
      submitText="Add"
      schema={CreateS3BucketFormSchema}
      persistenceKey={`s3-bucket-create:${teamId}`}
      secretKeyPlaceholder="AWS_SECRET_ACCESS_KEY"
      accessKeyIdPlaceholder="AWS_ACCESS_KEY_ID"
      defaultValues={{
        name: "",
        endpoint: "",
        region: "",
        bucket: "",
        accessKeyId: "",
        secretKey: "",
      }}
      error={createS3BucketError}
      resetError={createS3BucketReset}
      onSubmit={async (value) => {
        const res = await createS3Bucket({ ...value, teamId });
        temporarilyAddNewEntity(res.data.id);
        await invalidateS3Buckets();
      }}
    >
      {children}
    </S3BucketFormDialog>
  );
}

function S3BucketFormDialog({
  handle,
  title,
  description,
  submitText,
  schema,
  persistenceKey,
  accessKeyIdPlaceholder,
  secretKeyPlaceholder,
  defaultValues,
  error,
  resetError,
  onSubmit,
  children,
}: {
  handle: TDialogHandle;
  title: string;
  description: string;
  submitText: string;
  schema: typeof CreateS3BucketFormSchema;
  // Keeps a session draft of what was typed, only for the create form
  persistenceKey?: string;
  accessKeyIdPlaceholder: string;
  secretKeyPlaceholder: string;
  defaultValues: TS3BucketFormValues;
  error: Error | null;
  resetError: () => void;
  onSubmit: (value: TS3BucketFormValues) => Promise<void>;
  children?: ReactElement;
}) {
  const persistence: TFormPersistenceProps<TS3BucketFormValues> = persistenceKey
    ? { persistenceType: "session", persistenceKey, persistenceSchema: schema }
    : { persistenceType: "none" };

  const form = useAppFormWithPersistence({
    defaultValues,
    validators: {
      onChange: schema,
    },
    onSubmit: async ({ formApi, value }) => {
      await onSubmit(value);
      handle.close();
      formApi.reset();
      if (persistenceKey) {
        removeFormDraft({ persistenceType: "session", persistenceKey });
      }
    },
    ...persistence,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return (
    <Dialog
      handle={handle}
      onOpenChange={(o) => {
        // A persisted draft survives closing, the edit form re-seeds from the server instead
        if (o) {
          if (!persistenceKey) form.reset();
          return;
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          if (!persistenceKey) form.reset();
          resetError();
        }, defaultAnimationMs);
      }}
    >
      {children && <DialogTrigger render={children} />}
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
              <Label htmlFor="name">Display Name</Label>
              <form.AppField
                name="name"
                children={(field) => (
                  <field.TextField
                    id="name"
                    placeholder="Backup Bucket"
                    autoCapitalize="none"
                    dontCheckUntilSubmit
                    field={field}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full"
                    maxLength={s3BucketNameMaxLength}
                  />
                )}
              />
            </InputWrapper>
            <InputWrapper>
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
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-0">
              <InputWrapper className="w-full sm:w-1/2 sm:pr-2">
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
              <InputWrapper className="w-full sm:w-1/2 sm:pl-2">
                <Label htmlFor="bucket">Bucket</Label>
                <form.AppField
                  name="bucket"
                  children={(field) => (
                    <field.TextField
                      id="bucket"
                      placeholder="my-backups"
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
                    placeholder={accessKeyIdPlaceholder}
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
                    placeholder={secretKeyPlaceholder}
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
          {error && <ErrorLine className="mt-2" message={error.message} />}
          <div className="mt-2 flex w-full flex-wrap items-center justify-end gap-2">
            <DialogClose
              className="text-muted-foreground"
              render={
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              }
            />
            <form.Subscribe
              selector={(state) => ({ isSubmitting: state.isSubmitting })}
              children={({ isSubmitting }) => (
                <form.SubmitButton
                  data-submitting={isSubmitting || undefined}
                  isPending={isSubmitting ? true : false}
                >
                  {submitText}
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
