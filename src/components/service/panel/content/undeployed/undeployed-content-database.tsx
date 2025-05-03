import { databaseTypeToName } from "@/components/command-panel/context-command-panel/items/database";
import ErrorCard from "@/components/error-card";
import BrandIcon from "@/components/icons/brand";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import { TDatabaseBackupSourceState } from "@/components/service/panel/content/undeployed/service-panel-content-undeployed";
import { TStringOrNullState } from "@/components/service/panel/content/undeployed/types";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { api } from "@/server/trpc/setup/client";
import { CheckIcon, CylinderIcon, MilestoneIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const placeholderArray = Array.from({ length: 10 });

type TProps = {
  type: string;
  version: string;
  versionState: TStringOrNullState;
  backupSourceState: TDatabaseBackupSourceState;
};

export function UndeployedContentDatabase(props: TProps) {
  const { teamId } = useService();
  return (
    <S3SourcesProvider teamId={teamId}>
      <UndeployedContentDatabase_ {...props} />
    </S3SourcesProvider>
  );
}

function UndeployedContentDatabase_({ type, version, versionState, backupSourceState }: TProps) {
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  const [isBackupSourceDropdownOpen, setIsBackupSourceDropdownOpen] = useState(false);

  const backupsDisabled = type === "redis";
  const [currentVersion, setCurrentVersion] = versionState;
  const [currentBackupSource, setCurrentBackupSource] = backupSourceState;

  const { data, isPending, error } = api.services.getDatabase.useQuery({
    type,
  });

  const {
    query: { data: s3SourcesData, isPending: s3SourcesIsPending, error: s3SourcesError },
  } = useS3Sources();

  const buckets = useMemo(() => {
    if (!s3SourcesData) return undefined;
    const buckets: NonNullable<TDatabaseBackupSourceState[0]>[] = [];
    for (const source of s3SourcesData.sources) {
      for (const bucket of source.buckets) {
        buckets.push({
          bucket: bucket.name,
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

    if (!backupsDisabled && buckets && buckets.length > 0) {
      setBackupSourceCommandValue(`${buckets[0].source.id}:${buckets[0].bucket}`);
      if (!currentBackupSource) {
        setCurrentBackupSource(buckets[0]);
      }
    }

    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets]);

  const [backupSourceCommandValue, setBackupSourceCommandValue] = useState("");

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
                            Loading {index}
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
              <Popover
                open={isBackupSourceDropdownOpen}
                onOpenChange={setIsBackupSourceDropdownOpen}
              >
                <PopoverTrigger asChild>
                  <BlockItemButtonLike
                    asElement="button"
                    isPending={s3SourcesIsPending}
                    text={
                      currentBackupSource ? (
                        <>
                          {currentBackupSource.source.name}
                          <span className="text-muted-more-foreground">{" / "}</span>
                          {currentBackupSource.bucket}
                        </>
                      ) : (
                        "No bucket selected"
                      )
                    }
                    Icon={({ className }) => <CylinderIcon className={cn("scale-90", className)} />}
                    variant="outline"
                    open={isBackupSourceDropdownOpen}
                  />
                </PopoverTrigger>
                <PopoverContent
                  animate={false}
                  className="flex h-68 max-h-[min(30rem,var(--radix-popper-available-height))] overflow-hidden p-0"
                >
                  <Command
                    value={backupSourceCommandValue}
                    onValueChange={setBackupSourceCommandValue}
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
                                  Loading {index}
                                </p>
                              </CommandItem>
                            ))}
                          {s3SourcesError && !buckets && !s3SourcesIsPending && (
                            <ErrorCard className="rounded-md" message={s3SourcesError.message} />
                          )}
                          {buckets?.map((b) => (
                            <CommandItem
                              key={`${b.source.id}:${b.bucket}`}
                              value={`${b.source.id}:${b.bucket}`}
                              onSelect={(v) => {
                                setBackupSourceCommandValue(v);
                                setCurrentBackupSource(b);
                                setIsBackupSourceDropdownOpen(false);
                              }}
                              data-checked={
                                b.source.id === currentBackupSource?.source.id &&
                                b.bucket === currentBackupSource?.bucket
                                  ? true
                                  : undefined
                              }
                              className="group/item px-3"
                            >
                              <p className="min-w-0 shrink leading-tight">
                                {b.source.name}
                                <span className="text-muted-more-foreground">{` / `}</span>
                                {b.bucket}
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
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
    </>
  );
}
