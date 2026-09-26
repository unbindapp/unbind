-- +goose Up
-- modify "github_apps" table
ALTER TABLE "github_apps" ADD COLUMN "owner_login" character varying NULL, ADD COLUMN "owner_type" character varying NULL, ADD COLUMN "team_id" uuid NULL, ADD
CONSTRAINT "github_apps_teams_github_apps" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- apps whose creator was deleted go to the first user, so someone still sees them
UPDATE "github_apps" SET "created_by" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1) WHERE "created_by" IS NULL;

-- +goose Down
-- reverse: modify "github_apps" table
ALTER TABLE "github_apps" DROP CONSTRAINT "github_apps_teams_github_apps", DROP COLUMN "team_id", DROP COLUMN "owner_type", DROP COLUMN "owner_login";
