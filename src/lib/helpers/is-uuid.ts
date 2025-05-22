export function isUUID(str: string | undefined | null): boolean {
  if (typeof str !== "string") return false;
  return /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(str);
}
