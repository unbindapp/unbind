import { z } from "zod";

const invalidMountPathChars = ["<", ">", ":", '"', "|", "?", "*"];

// Mirrors the API's unix path check so bad paths are explained before the request
export function getMountPathError(path: string): string | null {
  if (!path.startsWith("/")) return 'Path should start with "/"';
  if (path.includes("\\")) return "Path can't contain backslashes";
  if (path.includes("//")) return "Path can't contain consecutive slashes";
  const invalidChar = invalidMountPathChars.find((char) => path.includes(char));
  if (invalidChar) return `Path can't contain ${invalidChar}`;
  return null;
}

export const MountPathSchema = z.string().superRefine((path, ctx) => {
  const error = getMountPathError(path);
  if (!error) return;
  ctx.addIssue({ code: "custom", message: error });
});
