-- +goose Up
-- create "team_icons" table
CREATE TABLE "team_icons" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "content_type" character varying NOT NULL,
  "data" bytea NOT NULL,
  "team_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "team_icons_teams_icon" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "team_icons_team_id_key" to table: "team_icons"
CREATE UNIQUE INDEX "team_icons_team_id_key" ON "team_icons" ("team_id");

-- +goose Down
-- reverse: create index "team_icons_team_id_key" to table: "team_icons"
DROP INDEX "team_icons_team_id_key";
-- reverse: create "team_icons" table
DROP TABLE "team_icons";
