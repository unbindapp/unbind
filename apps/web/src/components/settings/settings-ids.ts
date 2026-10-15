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
    access: "networking_access",
    public: "networking_public",
    private: "networking_private",
    maxRequestSize: "networking_max-request-size",
    sessionAffinity: "networking_session-affinity",
    clientIpHeader: "networking_client-ip-header",
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
    cronSchedule: "deploy_cron-schedule",
    cronTimezone: "deploy_cron-timezone",
    replicas: "deploy_replicas",
    rollout: "deploy_rollout",
    resourceLimits: "deploy_resource-limits",
  },
  health: {
    type: "health_type",
    startupCheck: "health_startup-check",
    healthCheck: "health_health-check",
  },
  database: {
    walLevel: "database_wal-level",
    replication: "database_replication",
    slotWalKeepSize: "database_slot-wal-keep-size",
    appendOnly: "database_append-only",
  },
} as const;

export const volumeSettingsIds = {
  connection: {
    service: "connection_service",
    mountPath: "connection_mount-path",
    volumeId: "connection_volume-id",
  },
} as const;
