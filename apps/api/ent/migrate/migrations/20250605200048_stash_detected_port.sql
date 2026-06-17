-- +goose Up
-- modify "services" table
ALTER TABLE "services" ADD COLUMN "detected_ports" jsonb NULL;

-- +goose Down
-- reverse: modify "services" table
ALTER TABLE "services" DROP COLUMN "detected_ports";
