import { defaultListSort, ListSortEnum, type TListSort } from "@/lib/list-sort";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

// Spread into the route's search schema
export const searchSortSearchSchema = {
  search: z.string().optional(),
  sort: ListSortEnum.optional().catch(undefined),
};

export function useSearchSortParams() {
  const navigate = useNavigate();
  const params = useSearch({ strict: false });

  // The input keeps its own value so typing never waits on the router
  const [search, setSearchState] = useState(params.search ?? "");
  const sort = params.sort ?? defaultListSort;

  const setParams = (patch: { search?: string; sort?: TListSort }) =>
    navigate({
      to: ".",
      search: (prev) => ({ ...prev, ...patch }),
      replace: true,
      resetScroll: false,
    });

  const setSearch = (value: string) => {
    setSearchState(value);
    setParams({ search: value || undefined });
  };

  const setSort = (value: TListSort) =>
    setParams({ sort: value === defaultListSort ? undefined : value });

  return { search, setSearch, sort, setSort };
}
