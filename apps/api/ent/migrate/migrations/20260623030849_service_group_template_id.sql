-- +goose Up
-- modify "service_groups" table
ALTER TABLE "service_groups" ADD COLUMN "template_id" uuid NULL;

-- +goose Down
-- reverse: modify "service_groups" table
ALTER TABLE "service_groups" DROP COLUMN "template_id";
