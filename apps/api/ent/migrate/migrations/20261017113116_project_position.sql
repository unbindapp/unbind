-- +goose Up
-- modify "projects" table
ALTER TABLE "projects" ADD COLUMN "position" bigint NOT NULL DEFAULT 0;
-- create index "project_team_id_position" to table: "projects"
CREATE INDEX "project_team_id_position" ON "projects" ("team_id", "position");

-- +goose Down
-- reverse: create index "project_team_id_position" to table: "projects"
DROP INDEX "project_team_id_position";
-- reverse: modify "projects" table
ALTER TABLE "projects" DROP COLUMN "position";
