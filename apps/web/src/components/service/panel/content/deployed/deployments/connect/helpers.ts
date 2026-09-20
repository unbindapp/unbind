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

// Engines that speak more than one protocol, so the section offers a choice of URLs
const MULTI_URL_DATABASE_TYPES = ["clickhouse"];

export function hasMultipleUrls(databaseType: string) {
  return MULTI_URL_DATABASE_TYPES.includes(databaseType);
}

const VARIABLE_NAME_BY_DATABASE_TYPE: Record<string, string> = {
  postgres: "DATABASE_URL",
  mysql: "DATABASE_URL",
  redis: "REDIS_URL",
  mongodb: "MONGO_URL",
  clickhouse: "CLICKHOUSE_URL",
};

// The name the variable gets on the service that is being pointed at the database. The
// protocol of a secondary endpoint goes in the middle, so ClickHouse's HTTP URL becomes
// CLICKHOUSE_HTTP_URL. The user can rename it before staging it.
export function variableNameFor(databaseType: string, label?: string) {
  const base = VARIABLE_NAME_BY_DATABASE_TYPE[databaseType] ?? "DATABASE_URL";
  if (!label) return base;
  const protocol = label.toUpperCase().replaceAll(" ", "_");
  return base.replace(/_URL$/, `_${protocol}_URL`);
}
