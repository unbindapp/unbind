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
    const regexParts = parts.map((part) => {
      // If part is quoted, use it exactly, otherwise make case insensitive
      if (part.startsWith('"') && part.endsWith('"')) {
        return escapeRegExp(part.substring(1, part.length - 1));
      } else {
        return `(?i)${escapeRegExp(part)}`;
      }
    });

    // Join with regex OR
    return `|~ "${regexParts.join("|")}"`;
  }

  // Handle AND expressions by converting to regexes that must all match
  if (search.includes(" AND ")) {
    const parts = search
      .split(" AND ")
      .map((part) => part.trim())
      .filter(Boolean);
    const regexParts = parts.map((part) => {
      // If part is quoted, use it exactly, otherwise make case insensitive
      if (part.startsWith('"') && part.endsWith('"')) {
        return `(?=.*${escapeRegExp(part.substring(1, part.length - 1))})`;
      } else {
        return `(?=.*(?i)${escapeRegExp(part)})`;
      }
    });

    // Use positive lookaheads to require all terms
    return `|~ "${regexParts.join("")}.*"`;
  }

  // Default case: simple case-insensitive regex search
  return `|~ "(?i)${escapeRegExp(search)}"`;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
