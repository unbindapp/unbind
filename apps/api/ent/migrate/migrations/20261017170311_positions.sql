-- +goose Up
-- modify "projects" table
ALTER TABLE "projects" ADD COLUMN "position" bigint NOT NULL DEFAULT 0;
-- create index "project_team_id_position" to table: "projects"
CREATE INDEX "project_team_id_position" ON "projects" ("team_id", "position");
-- modify "service_groups" table
ALTER TABLE "service_groups" ADD COLUMN "position" bigint NOT NULL DEFAULT 0;
-- modify "services" table
ALTER TABLE "services" ADD COLUMN "position" bigint NOT NULL DEFAULT 0;

-- +goose Down
-- reverse: modify "services" table
ALTER TABLE "services" DROP COLUMN "position";
-- reverse: modify "service_groups" table
ALTER TABLE "service_groups" DROP COLUMN "position";
-- reverse: create index "project_team_id_position" to table: "projects"
DROP INDEX "project_team_id_position";
-- reverse: modify "projects" table
ALTER TABLE "projects" DROP COLUMN "position";
