-- +goose Up
-- modify "registries" table
ALTER TABLE "registries" ALTER COLUMN "kubernetes_secret" SET NOT NULL;

-- +goose Down
-- reverse: modify "registries" table
ALTER TABLE "registries" ALTER COLUMN "kubernetes_secret" DROP NOT NULL;
