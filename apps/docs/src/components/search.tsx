"use client";
import { Button } from "@/components/ui/button";
import { useDocsSearch } from "fumadocs-core/search/client";
import { staticClient } from "fumadocs-core/search/client/orama-static";
import {
  SearchDialog,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogListItem,
  SearchDialogOverlay,
  useSearch,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { useI18n } from "fumadocs-ui/contexts/i18n";

function SearchClose() {
  const { onOpenChange } = useSearch();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      forceMinSize="medium"
      aria-label="Close search"
      onClick={() => onOpenChange(false)}
      className="text-muted-foreground px-2 py-1 font-mono text-xs"
    >
      ESC
    </Button>
  );
}

export default function DefaultSearchDialog(props: SharedProps) {
  const { locale } = useI18n();
  const { search, setSearch, query } = useDocsSearch({
    client: staticClient({
      from: "/search-index.json",
      locale,
    }),
  });

  return (
    <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchClose />
        </SearchDialogHeader>
        <SearchDialogList
          items={query.data !== "empty" ? query.data : null}
          Item={({ item, onClick }) => (
            <SearchDialogListItem
              item={item}
              onClick={onClick}
              className="aria-selected:bg-border aria-selected:text-foreground rounded-md"
            />
          )}
        />
      </SearchDialogContent>
    </SearchDialog>
  );
}
