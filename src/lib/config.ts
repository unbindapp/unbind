/**
 * Runtime configuration.
 *
 * The static bundle is identical across self-hosted installs; per-install values
 * (the API origin) are loaded at boot from `/config.json` so a single CDN artifact
 * can serve every deployment. `VITE_API_URL` is a build-time fallback for local dev.
 */
export type AppConfig = {
  apiUrl: string;
};

const fallbackConfig: AppConfig = {
  apiUrl: import.meta.env.VITE_API_URL ?? "https://api.unbind.app",
};

let config: AppConfig | null = null;

export async function loadConfig(): Promise<AppConfig> {
  // In local dev the API is reached through the Vite proxy (see vite.config.ts),
  // which makes it same-origin so the session cookie is first-party. Skip the
  // runtime /config.json fetch (it would otherwise pin apiUrl to the prod origin).
  if (import.meta.env.DEV) {
    config = { apiUrl: "/api" };
    return config;
  }
  try {
    const res = await fetch("/config.json", { cache: "no-cache" });
    if (res.ok) {
      const json = (await res.json()) as Partial<AppConfig>;
      config = { ...fallbackConfig, ...json };
      return config;
    }
  } catch {
    // fall through to the build-time fallback
  }
  config = fallbackConfig;
  return config;
}

export function getConfig(): AppConfig {
  if (!config) {
    throw new Error("Config not loaded yet. loadConfig() must run before getConfig().");
  }
  return config;
}
