-- +goose Up
-- modify "service_configs" table
ALTER TABLE "service_configs" ADD COLUMN "resources" jsonb NULL;

-- +goose Down
-- reverse: modify "service_configs" table
ALTER TABLE "service_configs" DROP COLUMN "resources";
