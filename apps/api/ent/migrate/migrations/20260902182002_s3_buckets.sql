-- +goose Up
-- create "s3_buckets" table
CREATE TABLE "s3_buckets" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "name" character varying NOT NULL,
  "endpoint" character varying NOT NULL,
  "region" character varying NOT NULL,
  "bucket" character varying NOT NULL,
  "kubernetes_secret" character varying NOT NULL,
  "team_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "s3_buckets_teams_s3_buckets" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- modify "service_configs" table
ALTER TABLE "service_configs" DROP COLUMN "s3_backup_bucket", DROP COLUMN "s3_backup_source_id", ADD COLUMN "s3_backup_bucket_id" uuid NULL, ADD
CONSTRAINT "service_configs_s3_buckets_service_backup_configs" FOREIGN KEY ("s3_backup_bucket_id") REFERENCES "s3_buckets" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- drop "s3_sources" table
DROP TABLE IF EXISTS "s3_sources";

-- +goose Down
-- reverse: modify "service_configs" table
ALTER TABLE "service_configs" DROP CONSTRAINT "service_configs_s3_buckets_service_backup_configs", DROP COLUMN "s3_backup_bucket_id", ADD COLUMN "s3_backup_source_id" uuid NULL, ADD COLUMN "s3_backup_bucket" character varying NULL;
-- reverse: create "s3_buckets" table
DROP TABLE "s3_buckets";
