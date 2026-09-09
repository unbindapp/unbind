// DOM ids for settings items, `<section id>_<item>`, used for hash links and jumps
export const settingsIds = {
  source: {
    repository: "source_repository",
    branch: "source_branch",
    image: "source_image",
    tag: "source_tag",
    database: "source_database",
    version: "source_version",
  },
  networking: {
    public: "networking_public",
    private: "networking_private",
  },
  backups: {
    bucket: "backups_bucket",
    schedule: "backups_schedule",
    retention: "backups_retention",
  },
  build: {
    builder: "build_builder",
    installCommand: "build_install-command",
    buildCommand: "build_build-command",
    dockerfilePath: "build_dockerfile-path",
    buildContext: "build_build-context",
    startCommand: "build_start-command",
    watchPaths: "build_watch-paths",
  },
  deploy: {
    replicas: "deploy_replicas",
    resourceLimits: "deploy_resource-limits",
  },
  health: {
    type: "health_type",
    startupCheck: "health_startup-check",
    healthCheck: "health_health-check",
  },
} as const;

export const volumeSettingsIds = {
  connection: {
    service: "connection_service",
    mountPath: "connection_mount-path",
  },
} as const;

export function scrollToSettingsItem(id: string) {
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
