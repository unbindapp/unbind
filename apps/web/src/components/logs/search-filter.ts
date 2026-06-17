export function createSearchFilter(search: string): string {
  if (!search || search.trim() === "") {
    return "";
  }

  // Escape any unescaped double quotes inside the search string.
  // This replaces " with \"
  const escapedSearch = search.replace(/"/g, '\\"');

  // Handle strict search with quotes (entire string is quoted)
  if (escapedSearch.startsWith('\\"') && escapedSearch.endsWith('\\"')) {
    const strictTerm = escapedSearch.substring(2, escapedSearch.length - 2);
    return `|= "${strictTerm}"`;
  }

  // Handle OR expressions by converting to regex alternation
  if (escapedSearch.includes(" OR ")) {
    const parts = escapedSearch
      .split(" OR ")
      .map((part) => part.trim())
      .filter(Boolean);
    // Remove extra escaped quotes for literal matching
    const regexParts = parts.map((part) => {
      return part.startsWith('\\"') && part.endsWith('\\"')
        ? part.substring(2, part.length - 2)
        : part;
    });
    // Build a case-insensitive alternation
    return `|~ "(?i:(${regexParts.join("|")}))"`;
  }

  // Handle AND expressions by converting to multiple filters
  if (escapedSearch.includes(" AND ")) {
    const parts = escapedSearch
      .split(" AND ")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts
      .map((part) => {
        if (part.startsWith('\\"') && part.endsWith('\\"')) {
          part = part.substring(2, part.length - 2);
        }
        return `|~ "(?i:${part})"`;
      })
      .join(" ");
  }

  // Default case: simple case-insensitive regex search
  return `|~ "(?i:${escapedSearch})"`;
}
