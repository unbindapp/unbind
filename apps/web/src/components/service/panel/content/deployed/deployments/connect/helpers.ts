export const PRIVATE_URL_KEY = "UNBIND_DATABASE_URL_PRIVATE";
const PUBLIC_URL_KEY = "UNBIND_DATABASE_URL_PUBLIC";

const MASK = "••••••••";
const URL_PASSWORD_REGEX = /^([a-z][a-z0-9+.-]*:\/\/[^:@/]*:)[^@]*(@.*)$/i;

export type TConnectionUrl = {
  key: string;
  // Set when the engine speaks more than one protocol, "HTTP" for UNBIND_DATABASE_URL_PRIVATE_HTTP
  label?: string;
  value: string;
};

type TProvidedVariable = { name: string; value: string; provided: boolean };

function connectionUrlsFor(variables: readonly TProvidedVariable[], baseKey: string) {
  const urls: TConnectionUrl[] = [];
  for (const variable of variables) {
    if (!variable.provided) continue;
    if (variable.name !== baseKey && !variable.name.startsWith(`${baseKey}_`)) continue;
    const suffix = variable.name.slice(baseKey.length + 1);
    urls.push({
      key: variable.name,
      label: suffix ? suffix.replaceAll("_", " ") : undefined,
      value: variable.value,
    });
  }
  // The primary protocol has the bare key and goes first
  return urls.sort((a, b) => a.key.length - b.key.length || a.key.localeCompare(b.key));
}

export function connectionUrls(variables: readonly TProvidedVariable[]) {
  return {
    private: connectionUrlsFor(variables, PRIVATE_URL_KEY),
    public: connectionUrlsFor(variables, PUBLIC_URL_KEY),
  };
}

// Only the password is hidden so the host and port stay readable. Anything that
// does not look like a URL with a password is hidden entirely.
export function maskUrlPassword(url: string) {
  if (!URL_PASSWORD_REGEX.test(url)) return MASK;
  return url.replace(URL_PASSWORD_REGEX, `$1${MASK}$2`);
}
