-- +goose Up
-- modify "system_settings" table
ALTER TABLE "system_settings" ADD COLUMN "email_settings" jsonb NULL;
-- create "invitations" table
CREATE TABLE "invitations" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "email" character varying NOT NULL,
  "token_hash" character varying NOT NULL,
  "role" character varying NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "accepted_at" timestamptz NULL,
  "team_id" uuid NOT NULL,
  "invited_by" uuid NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "invitations_teams_invitations" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "invitations_users_sent_invitations" FOREIGN KEY ("invited_by") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
-- create index "invitation_team_id" to table: "invitations"
CREATE INDEX "invitation_team_id" ON "invitations" ("team_id");
-- create index "invitations_token_hash_key" to table: "invitations"
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations" ("token_hash");

-- +goose Down
-- reverse: create index "invitations_token_hash_key" to table: "invitations"
DROP INDEX "invitations_token_hash_key";
-- reverse: create index "invitation_team_id" to table: "invitations"
DROP INDEX "invitation_team_id";
-- reverse: create "invitations" table
DROP TABLE "invitations";
-- reverse: modify "system_settings" table
ALTER TABLE "system_settings" DROP COLUMN "email_settings";
