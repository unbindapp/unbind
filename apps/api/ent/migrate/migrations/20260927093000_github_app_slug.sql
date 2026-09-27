-- +goose Up
-- modify "github_apps" table
ALTER TABLE "github_apps" ADD COLUMN "slug" character varying NULL;
-- saved apps kept their generated name, which GitHub uses as the slug as is
UPDATE "github_apps" SET "slug" = "name";
ALTER TABLE "github_apps" ALTER COLUMN "slug" SET NOT NULL;

-- +goose Down
-- reverse: modify "github_apps" table
ALTER TABLE "github_apps" DROP COLUMN "slug";
