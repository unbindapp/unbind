-- +goose Up
-- modify "service_configs" table
ALTER TABLE "service_configs" ADD COLUMN "stopped" boolean NOT NULL DEFAULT false;

-- +goose Down
-- reverse: modify "service_configs" table
ALTER TABLE "service_configs" DROP COLUMN "stopped";
