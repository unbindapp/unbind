-- +goose Up
-- modify "service_groups" table
ALTER TABLE "service_groups" ADD COLUMN "position" bigint NOT NULL DEFAULT 0;
-- modify "services" table
ALTER TABLE "services" ADD COLUMN "position" bigint NOT NULL DEFAULT 0;

-- +goose Down
-- reverse: modify "services" table
ALTER TABLE "services" DROP COLUMN "position";
-- reverse: modify "service_groups" table
ALTER TABLE "service_groups" DROP COLUMN "position";
