import fuzzysort from "fuzzysort";

import { settingsIds } from "./settings-ids.ts";

export type TSettingsSectionId =
  "source" | "networking" | "backups" | "build" | "deploy" | "health" | "database" | "danger";

export type TSettingsSearchItem = {
  id: string;
  title: string;
  description?: string;
  keywords: string[];
};

export type TSettingsSearchSection = {
  id: TSettingsSectionId;
  title: string;
  keywords: string[];
  items: TSettingsSearchItem[];
};

export const settingsSearchIndex: TSettingsSearchSection[] = [
  {
    id: "source",
    title: "Source",
    keywords: ["origin", "code"],
    items: [
      {
        id: settingsIds.source.repository,
        title: "Repository",
        keywords: ["git", "github", "repo"],
      },
      {
        id: settingsIds.source.branch,
        title: "Branch",
        keywords: ["git", "github", "ref", "main", "master"],
      },
      {
        id: settingsIds.source.image,
        title: "Image",
        keywords: ["docker", "container", "registry", "docker hub"],
      },
      {
        id: settingsIds.source.tag,
        title: "Tag",
        keywords: ["docker", "image", "version", "latest"],
      },
      {
        id: settingsIds.source.database,
        title: "Database",
        keywords: ["engine", "type", "postgres", "mysql", "redis", "mongodb", "clickhouse"],
      },
      {
        id: settingsIds.source.version,
        title: "Version",
        keywords: ["release", "database"],
      },
    ],
  },
  {
    id: "networking",
    title: "Networking",
    keywords: ["network", "url", "dns", "domain", "host", "port", "https", "tls", "ssl"],
    items: [
      {
        id: settingsIds.networking.public,
        title: "Public Networking",
        description: "Communicate with the service over the internet.",
        keywords: [
          "url",
          "dns",
          "domain",
          "custom domain",
          "host",
          "port",
          "https",
          "tls",
          "ssl",
          "certificate",
          "cloudflare",
          "external",
          "ingress",
        ],
      },
      {
        id: settingsIds.networking.private,
        title: "Private Networking",
        description: "Communicate with the service from within the Unbind's network.",
        keywords: ["url", "dns", "host", "port", "internal", "cluster", "service discovery"],
      },
    ],
  },
  {
    id: "backups",
    title: "Backups",
    keywords: ["backup", "snapshot", "restore", "s3"],
    items: [
      {
        id: settingsIds.backups.bucket,
        title: "Backup Bucket",
        description: "S3-compatible bucket to store the database backups.",
        keywords: ["s3", "storage", "bucket", "enable", "disable"],
      },
      {
        id: settingsIds.backups.schedule,
        title: "Backup Schedule",
        description: "How often the database is backed up.",
        keywords: ["cron", "frequency", "interval", "daily", "weekly", "hourly"],
      },
      {
        id: settingsIds.backups.retention,
        title: "Backup Retention",
        description: "How many backups to keep. Older backups are deleted.",
        keywords: ["keep", "count", "history", "cleanup"],
      },
    ],
  },
  {
    id: "build",
    title: "Build",
    keywords: ["compile", "ci"],
    items: [
      {
        id: settingsIds.build.builder,
        title: "Builder",
        description: "The builder for building the service to be deployed.",
        keywords: ["railpack", "docker", "dockerfile", "nixpacks", "buildpack"],
      },
      {
        id: settingsIds.build.installCommand,
        title: "Install Command",
        description: "The command for installing the dependencies for the service.",
        keywords: ["npm install", "pnpm", "yarn", "bun", "pip", "dependencies", "packages"],
      },
      {
        id: settingsIds.build.buildCommand,
        title: "Build Command",
        description: "The command for building the service.",
        keywords: ["npm run build", "compile", "bundle"],
      },
      {
        id: settingsIds.build.dockerfilePath,
        title: "Dockerfile Path",
        description: "The path to the Dockerfile in your repository.",
        keywords: ["docker", "dockerfile", "path", "file"],
      },
      {
        id: settingsIds.build.buildContext,
        title: "Build Context",
        description: "The directory that serves as the build context for Docker.",
        keywords: ["docker", "directory", "folder", "root"],
      },
      {
        id: settingsIds.build.startCommand,
        title: "Start Command",
        description: "The command to run to start the new deployment.",
        keywords: ["run", "entrypoint", "cmd", "npm start", "launch"],
      },
      {
        id: settingsIds.build.watchPaths,
        title: "Watch Paths",
        description: "Gitignore-style patterns. Leave empty to deploy on every push.",
        keywords: ["trigger", "auto deploy", "push", "glob", "pattern", "ignore", "monorepo"],
      },
    ],
  },
  {
    id: "deploy",
    title: "Deploy",
    keywords: ["deployment", "scale", "resources"],
    items: [
      {
        id: settingsIds.deploy.replicas,
        title: "Replicas",
        description: "The number of replicas/instances to run for this service.",
        keywords: ["instances", "scale", "count", "horizontal", "pods"],
      },
      {
        id: settingsIds.deploy.resourceLimits,
        title: "Resource Limits",
        description: "The maximum vCPU and memory to allocate for each instance.",
        keywords: ["cpu", "vcpu", "memory", "ram", "limits", "resources", "size"],
      },
    ],
  },
  {
    id: "health",
    title: "Health",
    keywords: ["health check", "probe", "monitor", "liveness", "readiness"],
    items: [
      {
        id: settingsIds.health.type,
        title: "Health Check Type",
        description: "The type of health check to decide if a deployment is healthy.",
        keywords: ["endpoint", "http", "path", "port", "command", "exec", "probe"],
      },
      {
        id: settingsIds.health.startupCheck,
        title: "Startup Check",
        description: "Instances are activated after one successful check.",
        keywords: ["startup", "readiness", "probe", "interval", "threshold", "retries"],
      },
      {
        id: settingsIds.health.healthCheck,
        title: "Health Check",
        description: "Monitor active instances and restart them if they are unhealthy.",
        keywords: ["liveness", "probe", "interval", "threshold", "retries", "restart"],
      },
    ],
  },
  {
    id: "database",
    title: "Database",
    keywords: ["postgres", "postgresql"],
    items: [
      {
        id: settingsIds.database.walLevel,
        title: "WAL Level",
        description: "The level of detail kept in the write-ahead log (WAL).",
        keywords: ["write-ahead log", "logical", "replica", "cdc"],
      },
      {
        id: settingsIds.database.replication,
        title: "Replication",
        description: "Each subscriber and streaming replica uses one slot and one sender.",
        keywords: ["slots", "senders", "wal", "subscriber", "logical", "cdc"],
      },
      {
        id: settingsIds.database.slotWalKeepSize,
        title: "Slot WAL Keep Size",
        description: "Caps the WAL kept for lagging replication slots.",
        keywords: ["wal", "disk", "size", "mb", "lag", "replication"],
      },
    ],
  },
  {
    id: "danger",
    title: "Delete Service",
    keywords: ["delete", "remove", "destroy", "danger", "destructive"],
    items: [],
  },
];

export type TSettingsSearchMatches = {
  sections: Set<TSettingsSectionId>;
  items: Set<string>;
};

// fuzzysort scores 1 for an exact match and 0.5 for a good one. Typos land around
// 0.35 and noise just under 0.3.
const goodScore = 0.5;
const typoScore = 0.3;

type TTier = "primary" | "fallback" | null;

function bestScore(query: string, targets: string[]) {
  let best = 0;
  for (const target of targets) {
    const score = fuzzysort.single(query, target)?.score ?? 0;
    if (score > best) best = score;
  }
  return best;
}

// A good match on the title or a keyword is primary. Typo-level matches and words
// inside descriptions only count when nothing matched primarily, so "Repository"
// does not also pull in every item that mentions a repository.
function tierOf(
  query: string,
  entry: { title: string; keywords: string[]; description?: string },
): TTier {
  const score = bestScore(query, [entry.title, ...entry.keywords]);
  if (score >= goodScore) return "primary";
  if (score >= typoScore) return "fallback";
  if (entry.description && bestScore(query, [entry.description]) >= goodScore) return "fallback";
  return null;
}

// Returns null for a blank query, meaning everything is visible. A section in
// `sections` matched on its own and shows all of its items.
export function matchSettings(
  query: string,
  index: TSettingsSearchSection[] = settingsSearchIndex,
): TSettingsSearchMatches | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const primary: TSettingsSearchMatches = { sections: new Set(), items: new Set() };
  const fallback: TSettingsSearchMatches = { sections: new Set(), items: new Set() };

  for (const section of index) {
    const sectionTier = tierOf(trimmed, section);
    if (sectionTier === "primary") {
      primary.sections.add(section.id);
      continue;
    }
    if (sectionTier === "fallback") fallback.sections.add(section.id);
    for (const item of section.items) {
      const tier = tierOf(trimmed, item);
      if (tier === "primary") primary.items.add(item.id);
      if (tier === "fallback") fallback.items.add(item.id);
    }
  }

  if (primary.sections.size > 0 || primary.items.size > 0) return primary;
  return fallback;
}
