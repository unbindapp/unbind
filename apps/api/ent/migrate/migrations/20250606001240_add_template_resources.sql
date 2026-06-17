-- +goose Up
-- modify "templates" table
ALTER TABLE "templates" ADD COLUMN "resource_recommendations" jsonb NOT NULL;

-- +goose Down
-- reverse: modify "templates" table
ALTER TABLE "templates" DROP COLUMN "resource_recommendations";
