-- +goose Up
-- modify "registries" table
ALTER TABLE "registries" ADD COLUMN "insecure" boolean NOT NULL DEFAULT false;

-- +goose Down
-- reverse: modify "registries" table
ALTER TABLE "registries" DROP COLUMN "insecure";
