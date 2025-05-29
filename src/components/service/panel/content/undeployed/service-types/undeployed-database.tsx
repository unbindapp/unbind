import { NewS3SourceTrigger } from "@/app/(team)/[team_id]/settings/storage/_components/s3-source-card";
import { databaseTypeToName } from "@/components/command-panel/context-command-panel/items/database";
import ErrorCard from "@/components/error-card";
import BrandIcon from "@/components/icons/brand";
import {
  TDatabaseBackupBucket,
  TDatabaseBackupBucketState,
} from "@/components/service/panel/content/service-panel-content-undeployed";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import { useService } from "@/components/service/service-provider";
import S3SourcesProvider, { useS3Sources } from "@/components/storage/s3-sources-provider";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { api } from "@/server/trpc/setup/client";
import { CheckIcon, CylinderIcon, MilestoneIcon, OctagonXIcon, PlusIcon } from "lucide-react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

const placeholderArray = Array.from({ length: 10 });

type TProps = {
  type: string;
  version: string;
};

export function UndeployedContentDatabase(props: TProps) {
  const { teamId } = useService();
  return (
    <S3SourcesProvider teamId={teamId}>
      <UndeployedContentDatabase_ {...props} />
    </S3SourcesProvider>
  );
}

function UndeployedContentDatabase_({ type, version }: TProps) {
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  const [isBackupBucketDropdownOpen, setIsBackupBucketDropdownOpen] = useState(false);

  const backupsDisabled = type === "redis";
  const [currentVersion, setCurrentVersion] = useState(version || null);
  const [currentBackupBucket, setCurrentBackupBucket] = useState<TDatabaseBackupBucket | null>(
    null,
  );

  const { data, isPending, error } = api.services.getDatabase.useQuery({
    type,
  });

  return (
    <>
      <Block>
        <BlockItem>
          <BlockItemHeader>
            <BlockItemTitle>Database</BlockItemTitle>
          </BlockItemHeader>
          <BlockItemContent>
            <BlockItemButtonLike
              asElement="div"
              Icon={({ className }) => (
                <BrandIcon brand={type} color="brand" className={className} />
              )}
              text={databaseTypeToName(type)}
            />
          </BlockItemContent>
        </BlockItem>
        <BlockItem>
          <BlockItemHeader>
            <BlockItemTitle>Version</BlockItemTitle>
          </BlockItemHeader>
          <BlockItemContent>
            <DropdownMenu open={isVersionDropdownOpen} onOpenChange={setIsVersionDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <BlockItemButtonLike
                  asElement="button"
                  Icon={({ className }) => <MilestoneIcon className={cn("scale-90", className)} />}
                  text={currentVersion || version}
                  variant="outline"
                  open={isVersionDropdownOpen}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[var(--radix-popper-anchor-width)]">
                <ScrollArea>
                  <DropdownMenuGroup>
                    {!data && !isPending && error && (
                      <ErrorCard className="rounded-md" message={error.message} />
                    )}
                    {data &&
                      data.database.version.options.map((v) => (
                        <DropdownMenuItem
                          key={v}
                          onSelect={() => {
                            setCurrentVersion(v);
                            setIsVersionDropdownOpen(false);
                          }}
                          data-checked={
                            (currentVersion === null && version === v) || currentVersion === v
                              ? true
                              : undefined
                          }
                          className="group/item"
                        >
                          <p className="min-w-0 shrink leading-tight">{v}</p>
                          <CheckIcon
                            strokeWidth={2.5}
                            className="-mr-0.5 ml-auto size-4.5 opacity-0 group-data-checked/item:opacity-100"
                          />
                        </DropdownMenuItem>
                      ))}
                    {!data &&
                      isPending &&
                      placeholderArray.map((_, index) => (
                        <DropdownMenuItem disabled key={index}>
                          <p className="bg-foreground animate-skeleton min-w-0 shrink rounded-md leading-tight">
                            Loading
                          </p>
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuGroup>
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </BlockItemContent>
        </BlockItem>
      </Block>
      {!backupsDisabled && (
        <Block>
          <BlockItem>
            <BlockItemHeader>
              <BlockItemTitle>Backup Bucket</BlockItemTitle>
            </BlockItemHeader>
            <BlockItemContent>
              <BackupBucketDropdown
                currentBackupBucket={currentBackupBucket}
                onSelect={(b) => setCurrentBackupBucket(b)}
                isBackupBucketDropdownOpen={isBackupBucketDropdownOpen}
                setIsBackupBucketDropdownOpen={setIsBackupBucketDropdownOpen}
              >
                <BlockItemButtonLike
                  asElement="button"
                  text={
                    currentBackupBucket ? (
                      <>
                        {currentBackupBucket.source.name}
                        <span className="text-muted-more-foreground">{" / "}</span>
                        {currentBackupBucket.name}
                      </>
                    ) : (
                      "No bucket selected"
                    )
                  }
                  Icon={({ className }) => <CylinderIcon className={cn("scale-90", className)} />}
                  variant="outline"
                  open={isBackupBucketDropdownOpen}
                />
              </BackupBucketDropdown>
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
    </>
  );
}

function getCommandItemValueFromBucket(bucket: TDatabaseBackupBucket) {
  return `${bucket.source.name} / ${bucket.name} - ${bucket.source.id}`;
}

function BackupBucketDropdown({
  currentBackupBucket,
  onSelect,
  isBackupBucketDropdownOpen,
  setIsBackupBucketDropdownOpen,
  children,
}: {
  currentBackupBucket: TDatabaseBackupBucket | null;
  onSelect: (bucket: TDatabaseBackupBucket | null) => void;
  isBackupBucketDropdownOpen: boolean;
  setIsBackupBucketDropdownOpen: (open: boolean) => void;
  children: ReactNode;
}) {
  const { teamId } = useService();
  const {
    query: { data: s3SourcesData, isPending: s3SourcesIsPending, error: s3SourcesError },
  } = useS3Sources();

  const buckets = useMemo(() => {
    if (!s3SourcesData) return undefined;
    const buckets: NonNullable<TDatabaseBackupBucketState[0]>[] = [];
    for (const source of s3SourcesData.sources) {
      for (const bucket of source.buckets) {
        buckets.push({
          name: bucket.name,
          source: source,
        });
      }
    }
    return buckets;
  }, [s3SourcesData]);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const timeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      scrollAreaRef.current?.scrollTo({ top: 0 });
    });

    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [buckets]);

  const [backupSourceCommandValue, setBackupBucketCommandValue] = useState("");

  if (buckets && buckets.length === 0) {
    return (
      <DropdownMenu open={isBackupBucketDropdownOpen} onOpenChange={setIsBackupBucketDropdownOpen}>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent animate={false} className="w-[var(--radix-popper-anchor-width)]">
          <ScrollArea>
            <DropdownMenuLabel className="border-b px-3">
              {"You don't have any buckets. Create a backup source."}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <NewS3SourceTrigger teamId={teamId}>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-1.5">
                  <PlusIcon className="-ml-1 size-5" />
                  <p className="min-w-0 shrink">Create Backup Source</p>
                </DropdownMenuItem>
              </NewS3SourceTrigger>
            </DropdownMenuGroup>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Popover open={isBackupBucketDropdownOpen} onOpenChange={setIsBackupBucketDropdownOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        animate={false}
        className="flex h-68 max-h-[min(30rem,var(--radix-popper-available-height))] overflow-hidden p-0"
      >
        <Command
          value={backupSourceCommandValue}
          onValueChange={setBackupBucketCommandValue}
          shouldFilter={s3SourcesIsPending ? false : true}
          wrapper="none"
          className="flex flex-1 flex-col"
        >
          <CommandInput
            onValueChange={() => {
              if (timeout.current) clearTimeout(timeout.current);
              timeout.current = setTimeout(() => {
                scrollAreaRef.current?.scrollTo({ top: 0 });
              });
            }}
            showSpinner={s3SourcesIsPending}
            placeholder="Search buckets..."
          />
          <ScrollArea viewportRef={scrollAreaRef} className="flex flex-1 flex-col">
            <CommandList>
              {buckets && (
                <CommandEmpty className="text-muted-foreground flex items-center justify-start gap-2 px-2.5 py-2.5 leading-tight">
                  <CylinderIcon className="size-4.5 shrink-0" />
                  <p className="min-w-0 shrink">No buckets found</p>
                </CommandEmpty>
              )}
              <CommandGroup>
                {s3SourcesIsPending &&
                  !buckets &&
                  placeholderArray.map((_, index) => (
                    <CommandItem disabled key={index}>
                      <p className="bg-foreground animate-skeleton min-w-0 shrink rounded-md leading-tight">
                        Loading {" / "} loading
                      </p>
                    </CommandItem>
                  ))}
                {s3SourcesError && !buckets && !s3SourcesIsPending && (
                  <ErrorCard className="rounded-md" message={s3SourcesError.message} />
                )}
                {buckets && currentBackupBucket && (
                  <CommandItem
                    value={"Disable backups"}
                    onSelect={(v) => {
                      setBackupBucketCommandValue(v);
                      onSelect(null);
                      setIsBackupBucketDropdownOpen(false);
                    }}
                    className="group/item text-warning data-[selected=true]:bg-warning/10 data-[selected=true]:text-warning px-3"
                  >
                    <OctagonXIcon className="-ml-0.25 size-4 shrink-0" />
                    <p className="min-w-0 shrink leading-tight">Disable backups</p>
                  </CommandItem>
                )}
                {buckets?.map((b) => (
                  <CommandItem
                    key={getCommandItemValueFromBucket(b)}
                    value={getCommandItemValueFromBucket(b)}
                    onSelect={(v) => {
                      setBackupBucketCommandValue(v);
                      onSelect(b);
                      setIsBackupBucketDropdownOpen(false);
                    }}
                    data-checked={
                      b.source.id === currentBackupBucket?.source.id &&
                      b.name === currentBackupBucket?.name
                        ? true
                        : undefined
                    }
                    className="group/item px-3"
                  >
                    <p className="min-w-0 shrink leading-tight">
                      {b.source.name}
                      <span className="text-muted-more-foreground">{` / `}</span>
                      {b.name}
                    </p>
                    <CheckIcon
                      strokeWidth={2.5}
                      className="-mr-0.5 ml-auto size-4.5 opacity-0 group-data-checked/item:opacity-100"
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
