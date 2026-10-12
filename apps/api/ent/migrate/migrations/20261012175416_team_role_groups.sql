-- +goose Up
-- modify "groups" table
ALTER TABLE "groups" ADD COLUMN "role" character varying NULL, ADD COLUMN "team_id" uuid NULL, ADD
CONSTRAINT "groups_teams_role_groups" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- create index "group_team_id_role" to table: "groups"
CREATE UNIQUE INDEX "group_team_id_role" ON "groups" ("team_id", "role");

-- +goose Down
-- reverse: create index "group_team_id_role" to table: "groups"
DROP INDEX "group_team_id_role";
-- reverse: modify "groups" table
ALTER TABLE "groups" DROP CONSTRAINT "groups_teams_role_groups", DROP COLUMN "team_id", DROP COLUMN "role";
