import { isNonDockerHubImage } from "@/components/command-panel/context-command-panel/items/docker-image";
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
import { defaultDebounceMs } from "@/lib/constants";
import { api } from "@/server/trpc/setup/client";
import { CheckIcon, TagIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";

const placeholderArray = Array.from({ length: 10 });

export function UndeployedContentDockerImage({
  image,
  tag,
  tagState,
}: {
  image: string;
  tag: string;
  tagState: TStringOrNullState;
}) {
  return (
    <Block>
      <BlockItem>
        <BlockItemHeader>
          <BlockItemTitle>Image</BlockItemTitle>
        </BlockItemHeader>
        <BlockItemContent>
          <BlockItemButtonLike
            asElement="div"
            Icon={({ className }) => (
              <BrandIcon brand="docker" color="brand" className={className} />
            )}
            text={image}
          />
        </BlockItemContent>
      </BlockItem>
      <BlockItem>
        <BlockItemHeader>
          <BlockItemTitle>Tag</BlockItemTitle>
        </BlockItemHeader>
        <BlockItemContent>
          <TagBlockItem image={image} tag={tag} tagState={tagState} />
        </BlockItemContent>
      </BlockItem>
    </Block>
  );
}

function TagBlockItem({
  image,
  tag,
  tagState,
}: {
  image: string;
  tag: string;
  tagState: TStringOrNullState;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentTag, setCurrentTag] = tagState;

  const [commandValue, setCommandValue] = useState("");
  const [commandInputValue, setCommandInputValue] = useState("");

  const imageIsNonDockerHub = isNonDockerHubImage(image);

  const [search] = useDebounce(commandInputValue, defaultDebounceMs);
  const { data, isPending, error } = api.docker.listTags.useQuery(
    {
      repository: image,
      search: commandInputValue ? search : commandInputValue,
    },
    {
      enabled: !imageIsNonDockerHub,
    },
  );

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const timeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      scrollAreaRef.current?.scrollTo({ top: 0 });
    });

    if (data && data.tags.length > 0) {
      setCommandValue(data.tags[0].name);
    }

    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [data]);

  if (imageIsNonDockerHub) {
    return (
      <BlockItemButtonLike
        asElement="div"
        Icon={({ className }) => <TagIcon className={cn("scale-90", className)} />}
        text={currentTag || tag}
      />
    );
  }

  return (
    <Popover open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <PopoverTrigger asChild>
        <BlockItemButtonLike
          asElement="button"
          Icon={({ className }) => <TagIcon className={cn("scale-90", className)} />}
          text={currentTag || tag}
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
          shouldFilter={false}
          wrapper="none"
          className="flex flex-1 flex-col"
        >
          <CommandInput
            value={commandInputValue}
            onValueChange={setCommandInputValue}
            showSpinner={isPending}
            placeholder="Search tags..."
          />
          <ScrollArea viewportRef={scrollAreaRef} className="flex flex-1 flex-col">
            <CommandList>
              {data && (
                <CommandEmpty className="text-muted-foreground flex items-center justify-start gap-2 px-2.5 py-2.5 leading-tight">
                  <TagIcon className="size-4.5 shrink-0" />
                  <p className="min-w-0 shrink">No tags found</p>
                </CommandEmpty>
              )}
              <CommandGroup>
                {!data &&
                  isPending &&
                  placeholderArray.map((_, index) => (
                    <CommandItem disabled key={index}>
                      <p className="bg-foreground animate-skeleton min-w-0 shrink rounded-md leading-tight">
                        Loading
                      </p>
                    </CommandItem>
                  ))}
                {!data && !isPending && error && (
                  <ErrorCard className="rounded-md" message={error.message} />
                )}
                {data &&
                  data.tags.map((t) => (
                    <CommandItem
                      onSelect={(v) => {
                        setCurrentTag(v);
                        setIsDropdownOpen(false);
                        setCommandInputValue("");
                      }}
                      key={t.name}
                      data-checked={
                        (currentTag === null && tag === t.name) || currentTag === t.name
                          ? true
                          : undefined
                      }
                      className="group/item px-3"
                    >
                      <p className="min-w-0 shrink leading-tight">{t.name}</p>
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
