-- +goose Up
-- modify "service_configs" table
ALTER TABLE "service_configs" ADD COLUMN "cron_schedule" character varying NULL, ADD COLUMN "cron_timezone" character varying NULL;

-- +goose Down
-- reverse: modify "service_configs" table
ALTER TABLE "service_configs" DROP COLUMN "cron_timezone", DROP COLUMN "cron_schedule";
