-- +goose Up
-- modify "projects" table
ALTER TABLE "projects" ADD COLUMN "tags" jsonb NULL;

-- +goose Down
-- reverse: modify "projects" table
ALTER TABLE "projects" DROP COLUMN "tags";
