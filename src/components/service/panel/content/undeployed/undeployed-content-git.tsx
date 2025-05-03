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
import { CheckIcon, GitBranchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const placeholderArray = Array.from({ length: 10 });

export function UndeployedContentGit({
  repo,
  owner,
  branch,
  installationId,
  branchState,
}: {
  repo: string;
  owner: string;
  branch: string;
  installationId: number;
  branchState: TStringOrNullState;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentBranch, setCurrentBranch] = branchState;

  const [commandValue, setCommandValue] = useState("");

  const { data, isPending, error } = api.git.getRepository.useQuery({
    owner,
    repoName: repo,
    installationId,
  });

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const timeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      scrollAreaRef.current?.scrollTo({ top: 0 });
    });

    if (data?.repository.branches && data.repository.branches.length > 0) {
      setCommandValue(data.repository.branches[0].name);
    }

    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [data]);

  return (
    <Block>
      <BlockItem>
        <BlockItemHeader>
          <BlockItemTitle>Repository</BlockItemTitle>
        </BlockItemHeader>
        <BlockItemContent>
          <BlockItemButtonLike
            asElement="div"
            text={`${owner}/${repo}`}
            Icon={({ className }) => (
              <BrandIcon brand="github" color="brand" className={className} />
            )}
          />
        </BlockItemContent>
      </BlockItem>
      <BlockItem>
        <BlockItemHeader>
          <BlockItemTitle>Branch</BlockItemTitle>
        </BlockItemHeader>
        <BlockItemContent>
          <Popover open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <PopoverTrigger asChild>
              <BlockItemButtonLike
                asElement="button"
                text={currentBranch || branch}
                Icon={({ className }) => <GitBranchIcon className={cn("scale-90", className)} />}
                variant="outline"
                open={isDropdownOpen}
              />
            </PopoverTrigger>
            <PopoverContent
              animate={false}
              className="flex h-68 max-h-[min(30rem,var(--radix-popper-available-height))] overflow-hidden p-0"
            >
              <Command
                value={commandValue}
                onValueChange={setCommandValue}
                shouldFilter={isPending ? false : true}
                wrapper="none"
                className="flex flex-1 flex-col"
              >
                <CommandInput showSpinner={isPending} placeholder="Search branches..." />
                <ScrollArea viewportRef={scrollAreaRef} className="flex flex-1 flex-col">
                  <CommandList>
                    {data && (
                      <CommandEmpty className="text-muted-foreground flex items-center justify-start gap-2 px-2.5 py-2.5 leading-tight">
                        <GitBranchIcon className="size-4.5 shrink-0" />
                        <p className="min-w-0 shrink">No branch found</p>
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
                        <ErrorCard className="rounded-md" message={error.message} />
                      )}
                      {data &&
                        data.repository.branches?.map((b) => (
                          <CommandItem
                            onSelect={(v) => {
                              setCurrentBranch(v);
                              setIsDropdownOpen(false);
                            }}
                            key={b.name}
                            className="group/item px-3"
                            data-checked={
                              (currentBranch === null && branch === b.name) ||
                              currentBranch === b.name
                                ? true
                                : undefined
                            }
                          >
                            <p className="min-w-0 shrink leading-tight">{b.name}</p>
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
  );
}
