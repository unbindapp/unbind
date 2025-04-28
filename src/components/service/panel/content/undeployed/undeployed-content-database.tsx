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
import { TStringOrNullState } from "@/components/service/panel/content/undeployed/types";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { api } from "@/server/trpc/setup/client";
import { MilestoneIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const placeholderArray = Array.from({ length: 10 });

export function UndeployedContentDatabase({
  type,
  version,
}: {
  type: string;
  version: string | undefined;
  versionState: TStringOrNullState;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  /* const [currentVersion, setCurrentVersion] = versionState; */

  const [commandValue, setCommandValue] = useState("");
  const [commandInputValue, setCommandInputValue] = useState("");

  const { data, isPending, error } = api.services.getDatabase.useQuery({
    type,
  });

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const timeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      scrollAreaRef.current?.scrollTo({ top: 0 });
    });

    /* if (data && data.tags.length > 0) {
      setCommandValue(data.tags[0].name);
    } */

    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [data]);

  return (
    <Block>
      <BlockItem>
        <BlockItemHeader>
          <BlockItemTitle>Database</BlockItemTitle>
        </BlockItemHeader>
        <BlockItemContent>
          <BlockItemButtonLike
            asElement="div"
            Icon={({ className }) => <BrandIcon brand={type} color="brand" className={className} />}
            text={databaseTypeToName(type)}
          />
        </BlockItemContent>
      </BlockItem>
      {version !== undefined && (
        <BlockItem>
          <BlockItemHeader>
            <BlockItemTitle>Version</BlockItemTitle>
          </BlockItemHeader>
          <BlockItemContent>
            <Popover open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
              <PopoverTrigger asChild>
                <BlockItemButtonLike
                  asElement="button"
                  Icon={({ className }) => <MilestoneIcon className={cn("scale-90", className)} />}
                  text={/* currentVersion || */ version}
                  variant="outline"
                  open={isDropdownOpen}
                  className="group/button flex w-full flex-row items-center justify-start gap-2 border px-3 text-left"
                />
              </PopoverTrigger>
              <PopoverContent className="flex h-68 max-h-[min(30rem,var(--radix-popper-available-height))] overflow-hidden p-0">
                <Command
                  value={commandValue}
                  onValueChange={setCommandValue}
                  wrapper="none"
                  className="flex flex-1 flex-col"
                >
                  <CommandInput
                    value={commandInputValue}
                    onValueChange={setCommandInputValue}
                    showSpinner={isPending}
                    placeholder="Search versions..."
                  />
                  <ScrollArea viewportRef={scrollAreaRef} className="flex flex-1 flex-col">
                    <CommandList>
                      {data && (
                        <CommandEmpty className="text-muted-foreground flex items-center justify-start gap-2 px-2.5 py-2.5 leading-tight">
                          <MilestoneIcon className="size-4.5 shrink-0" />
                          <p className="min-w-0 shrink">No versions found</p>
                        </CommandEmpty>
                      )}
                      <CommandGroup>
                        {!data &&
                          isPending &&
                          placeholderArray.map((_, index) => (
                            <CommandItem disabled key={index}>
                              <p className="bg-foreground animate-skeleton min-w-0 shrink rounded-md leading-tight">
                                Loading {index}
                              </p>
                            </CommandItem>
                          ))}
                        {!data && !isPending && error && (
                          <ErrorCard className="rounded-lg" message={error.message} />
                        )}
                        {/* {data &&
                          data.tags.map((tag) => (
                            <CommandItem
                              onSelect={(v) => {
                                setCurrentVersion(v);
                                setIsDropdownOpen(false);
                                setCommandInputValue("");
                              }}
                              key={tag.name}
                            >
                              <p className="min-w-0 shrink leading-tight">{tag.name}</p>
                            </CommandItem>
                          ))} */}
                      </CommandGroup>
                    </CommandList>
                  </ScrollArea>
                </Command>
              </PopoverContent>
            </Popover>
          </BlockItemContent>
        </BlockItem>
      )}
    </Block>
  );
}
