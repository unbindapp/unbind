-- +goose Up
-- modify "groups" table
ALTER TABLE "groups" ADD COLUMN "project_id" uuid NULL, ADD
CONSTRAINT "groups_projects_role_groups" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- create index "group_project_id_role" to table: "groups"
CREATE UNIQUE INDEX "group_project_id_role" ON "groups" ("project_id", "role");
-- modify "invitations" table
ALTER TABLE "invitations" ADD COLUMN "project_id" uuid NULL, ADD
CONSTRAINT "invitations_projects_invitations" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- create index "invitation_project_id" to table: "invitations"
CREATE INDEX "invitation_project_id" ON "invitations" ("project_id");

-- +goose Down
-- reverse: create index "invitation_project_id" to table: "invitations"
DROP INDEX "invitation_project_id";
-- reverse: modify "invitations" table
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_projects_invitations", DROP COLUMN "project_id";
-- reverse: create index "group_project_id_role" to table: "groups"
DROP INDEX "group_project_id_role";
-- reverse: modify "groups" table
ALTER TABLE "groups" DROP CONSTRAINT "groups_projects_role_groups", DROP COLUMN "project_id";
