-- +goose Up
-- modify "service_configs" table
ALTER TABLE "service_configs" ADD COLUMN "watch_paths" jsonb NULL;

-- +goose Down
-- reverse: modify "service_configs" table
ALTER TABLE "service_configs" DROP COLUMN "watch_paths";
