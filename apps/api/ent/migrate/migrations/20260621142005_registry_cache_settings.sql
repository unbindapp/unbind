-- +goose Up
-- modify "system_settings" table
ALTER TABLE "system_settings" ADD COLUMN "registry_cache_settings" jsonb NULL;

-- +goose Down
-- reverse: modify "system_settings" table
ALTER TABLE "system_settings" DROP COLUMN "registry_cache_settings";
