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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { api } from "@/server/trpc/setup/client";
import { MilestoneIcon } from "lucide-react";
import { useState } from "react";

const placeholderArray = Array.from({ length: 4 });

export function UndeployedContentDatabase({
  type,
  version,
  versionState,
}: {
  type: string;
  version: string;
  versionState: TStringOrNullState;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentVersion, setCurrentVersion] = versionState;

  const { data, isPending, error } = api.services.getDatabase.useQuery({
    type,
  });

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
      <BlockItem>
        <BlockItemHeader>
          <BlockItemTitle>Version</BlockItemTitle>
        </BlockItemHeader>
        <BlockItemContent>
          <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <BlockItemButtonLike
                asElement="button"
                Icon={({ className }) => <MilestoneIcon className={cn("scale-90", className)} />}
                text={currentVersion || version}
                variant="outline"
                open={isDropdownOpen}
                className="group/button flex w-full flex-row items-center justify-start gap-2 border px-3 text-left"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[var(--radix-popper-anchor-width)]">
              <ScrollArea>
                <DropdownMenuGroup>
                  {!data && !isPending && error && (
                    <ErrorCard className="rounded-lg" message={error.message} />
                  )}
                  {data &&
                    data.database.version.options.map((version) => (
                      <DropdownMenuItem
                        onSelect={() => {
                          setCurrentVersion(version);
                          setIsDropdownOpen(false);
                        }}
                        key={version}
                      >
                        <p className="min-w-0 shrink leading-tight">{version}</p>
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
  );
}
