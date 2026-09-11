const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function deletedBreakdownName(key: string) {
  if (!uuidRegex.test(key)) return key;
  return `Deleted: ${key.slice(0, 8)}`;
}
