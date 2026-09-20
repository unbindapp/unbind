export const uniqueNameMaxLength = 32;

const suffixLength = 4;
const suffixAttempts = 10;
const suffixCharset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// Names are compared the way the server does it: trimmed and case sensitive
export function isNameTaken(name: string, takenNames: string[]) {
  return takenNames.includes(name.trim());
}

export type TUniqueAmong = {
  names: string[];
  // with its article, like "a project" or "an environment"
  entity: string;
};

// For names the user types. currentName is the entity's own name, which it may keep.
export function getTakenNameError(name: string, uniqueAmong?: TUniqueAmong, currentName?: string) {
  if (!uniqueAmong) return undefined;
  if (currentName !== undefined && name.trim() === currentName) return undefined;
  if (!isNameTaken(name, uniqueAmong.names)) return undefined;
  return { message: `There is already ${uniqueAmong.entity} with this name.` };
}

// For names the user never types. The server does the same to a taken name, doing it here
// as well keeps what is shown before the response equal to what comes back.
export function getUniqueName(name: string, takenNames: string[], maxLength = uniqueNameMaxLength) {
  const fitted = truncate(name.trim(), maxLength);
  if (!isNameTaken(fitted, takenNames)) return fitted;

  for (let attempt = 0; attempt < suffixAttempts; attempt++) {
    const base = truncate(fitted, maxLength - suffixLength - 1).replace(/[- ]+$/, "");
    const candidate = `${base}-${randomSuffix()}`;
    if (!isNameTaken(candidate, takenNames)) return candidate;
  }
  return fitted;
}

function truncate(name: string, maxLength: number) {
  return Array.from(name).slice(0, maxLength).join("");
}

function randomSuffix() {
  const values = crypto.getRandomValues(new Uint32Array(suffixLength));
  return Array.from(values, (value) => suffixCharset[value % suffixCharset.length]).join("");
}
