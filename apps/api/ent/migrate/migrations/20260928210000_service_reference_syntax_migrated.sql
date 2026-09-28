-- +goose Up
-- modify "system_settings" table
ALTER TABLE "system_settings" ADD COLUMN "service_reference_syntax_migrated" boolean NOT NULL DEFAULT false;

-- +goose Down
-- reverse: modify "system_settings" table
ALTER TABLE "system_settings" DROP COLUMN "service_reference_syntax_migrated";
