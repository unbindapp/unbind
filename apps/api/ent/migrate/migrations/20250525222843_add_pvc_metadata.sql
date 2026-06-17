-- +goose Up
-- create "pvc_metadata" table
CREATE TABLE "pvc_metadata" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "pvc_id" character varying NOT NULL,
  "name" character varying NULL,
  "description" character varying NULL,
  PRIMARY KEY ("id")
);
-- create index "pvc_metadata_pvc_id_key" to table: "pvc_metadata"
CREATE UNIQUE INDEX "pvc_metadata_pvc_id_key" ON "pvc_metadata" ("pvc_id");

-- +goose Down
-- reverse: create index "pvc_metadata_pvc_id_key" to table: "pvc_metadata"
DROP INDEX "pvc_metadata_pvc_id_key";
-- reverse: create "pvc_metadata" table
DROP TABLE "pvc_metadata";
