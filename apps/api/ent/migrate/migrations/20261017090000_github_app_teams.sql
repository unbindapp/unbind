-- +goose Up
-- create "team_github_apps" table
CREATE TABLE "team_github_apps" (
  "team_id" uuid NOT NULL,
  "github_app_id" bigint NOT NULL,
  PRIMARY KEY ("team_id", "github_app_id"),
  CONSTRAINT "team_github_apps_github_app_id" FOREIGN KEY ("github_app_id") REFERENCES "github_apps" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "team_github_apps_team_id" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- apps shared with a team keep that team
INSERT INTO "team_github_apps" ("team_id", "github_app_id") SELECT "team_id", "id" FROM "github_apps" WHERE "team_id" IS NOT NULL;
-- modify "github_apps" table
ALTER TABLE "github_apps" DROP CONSTRAINT "github_apps_teams_github_apps", DROP COLUMN "team_id", ADD COLUMN "shared_with_all_teams" boolean NOT NULL DEFAULT false;

-- +goose Down
-- reverse: modify "github_apps" table
ALTER TABLE "github_apps" DROP COLUMN "shared_with_all_teams", ADD COLUMN "team_id" uuid NULL, ADD CONSTRAINT "github_apps_teams_github_apps" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- an app shared with several teams keeps one of them
UPDATE "github_apps" SET "team_id" = (SELECT "team_id" FROM "team_github_apps" WHERE "github_app_id" = "github_apps"."id" LIMIT 1);
-- reverse: create "team_github_apps" table
DROP TABLE "team_github_apps";
