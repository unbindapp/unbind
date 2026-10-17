import { useSettingsSearch } from "@/components/service/panel/content/deployed/settings/settings-search-provider";
import SearchInput from "@/components/ui/search-input";

export default function SettingsSearchBar({ className }: { className?: string }) {
  const { query, setQuery } = useSettingsSearch();

  return (
    <SearchInput
      value={query}
      onValueChange={setQuery}
      placeholder="Search settings"
      className={className}
    />
  );
}
