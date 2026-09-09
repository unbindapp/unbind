const invalidMountPathChars = ["\\", "<", ">", ":", '"', "|", "?", "*", "//"];

// Mirrors the API's unix path check so bad paths are rejected before the request
export function isValidMountPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  return !invalidMountPathChars.some((chars) => path.includes(chars));
}
