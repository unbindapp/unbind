-- +goose Up
-- modify "variable_references" table
ALTER TABLE "variable_references" ADD COLUMN "migrated_at" timestamptz NULL;

-- +goose Down
-- reverse: modify "variable_references" table
ALTER TABLE "variable_references" DROP COLUMN "migrated_at";
