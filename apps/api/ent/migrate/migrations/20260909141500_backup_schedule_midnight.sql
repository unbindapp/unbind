-- +goose Up
-- modify "service_configs" table
ALTER TABLE "service_configs" ALTER COLUMN "backup_schedule" SET DEFAULT '0 0 * * *';
-- the old default was never user-visible, so move it to the new one
UPDATE "service_configs" SET "backup_schedule" = '0 0 * * *' WHERE "backup_schedule" = '5 5 * * *';

-- +goose Down
-- reverse: modify "service_configs" table
ALTER TABLE "service_configs" ALTER COLUMN "backup_schedule" SET DEFAULT '5 5 * * *';
