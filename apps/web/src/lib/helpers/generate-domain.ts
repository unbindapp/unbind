export const generateDomain = ({
  name,
  wildcardDomain,
  seed,
}: {
  name: string;
  wildcardDomain: string;
  seed: string;
}) => {
  const cleanedName = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ") // single-space normalize
    .replace(/[^a-z0-9 _-]+/g, "") // strip invalid chars
    .replace(/ /g, "-"); // space → dash
  return `${cleanedName || "service"}-${hashToSuffix(seed, 6)}.${wildcardDomain}`;
};

const ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";

// FNV-1a; deterministic so the same seed always yields the same domain
function hashToSuffix(seed: string, length: number): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHANUM[(hash >>> 0) % ALPHANUM.length];
    hash = Math.imul(hash ^ (hash >>> 15), 0x01000193);
  }
  return out;
}
