export const generateDomain = (name: string, wildcardDomain: string) => {
  const cleanedName = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ") // single-space normalize
    .replace(/[^a-z0-9 ]+/g, "") // strip invalid chars
    .replace(/ /g, "-"); // space → dash
  return `${cleanedName || "service"}-${randomString(6)}.${wildcardDomain}`;
};

const ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomString(length: number): string {
  let out = "";
  // Prefer crypto for better randomness if available
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    for (const b of bytes) out += ALPHANUM[b % ALPHANUM.length];
  } else {
    for (let i = 0; i < length; i++) {
      out += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
    }
  }
  return out;
}
