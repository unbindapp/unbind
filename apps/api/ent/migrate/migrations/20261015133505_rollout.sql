-- +goose Up
-- modify "service_configs" table
ALTER TABLE "service_configs" ADD COLUMN "rollout" character varying NOT NULL DEFAULT 'rolling';

-- +goose Down
-- reverse: modify "service_configs" table
ALTER TABLE "service_configs" DROP COLUMN "rollout";
