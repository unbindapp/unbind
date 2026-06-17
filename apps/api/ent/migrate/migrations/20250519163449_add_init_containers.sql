-- +goose Up
-- modify "service_configs" table
ALTER TABLE "service_configs" ADD COLUMN "init_containers" jsonb NULL;

-- +goose Down
-- reverse: modify "service_configs" table
ALTER TABLE "service_configs" DROP COLUMN "init_containers";
