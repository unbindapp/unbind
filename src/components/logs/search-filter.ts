export function createSearchFilter(search: string): string {
  if (!search || search.trim() === "") {
    return "";
  }

  // Handle strict search with quotes (entire string is quoted)
  if (search.startsWith('"') && search.endsWith('"')) {
    const strictTerm = search.substring(1, search.length - 1);
    return `|= "${strictTerm}"`;
  }

  // Handle OR expressions by converting to regex alternation
  if (search.includes(" OR ")) {
    const parts = search
      .split(" OR ")
      .map((part) => part.trim())
      .filter(Boolean);
    // Remove quotes if present for literal matching
    const regexParts = parts.map((part) => {
      return part.startsWith('"') && part.endsWith('"') ? part.substring(1, part.length - 1) : part;
    });
    // Build a case-insensitive alternation
    return `|~ "(?i:(${regexParts.join("|")}))"`;
  }

  // Handle AND expressions by converting to an in-order regex
  if (search.includes(" AND ")) {
    const parts = search
      .split(" AND ")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        return part.startsWith('"') && part.endsWith('"')
          ? part.substring(1, part.length - 1)
          : part;
      });
    // Concatenate parts with .* so they must appear in order
    return `|~ "(?i:${parts.join(".*")})"`;
  }

  // Default case: simple case-insensitive regex search
  return `|~ "(?i:${search})"`;
}
