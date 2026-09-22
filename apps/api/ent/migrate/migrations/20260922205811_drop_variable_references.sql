-- +goose Up
-- The rows were written into the service secrets as templates by every release since
-- v0.1.50. A row that was never migrated means this instance skipped those releases,
-- and dropping it would lose the reference.
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "variable_references" WHERE "migrated_at" IS NULL) THEN
    RAISE EXCEPTION 'variable_references still has rows that were never migrated. Start any Unbind release from v0.1.50 to v0.1.82 once before upgrading to this one.';
  END IF;
END $$;
-- +goose StatementEnd
-- drop "variable_references" table
DROP TABLE "variable_references";

-- +goose Down
-- reverse: drop "variable_references" table
CREATE TABLE "variable_references" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "target_name" character varying NOT NULL,
  "sources" jsonb NOT NULL,
  "value_template" character varying NOT NULL,
  "error" character varying NULL,
  "migrated_at" timestamptz NULL,
  "target_service_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "variable_references_services_variable_references" FOREIGN KEY ("target_service_id") REFERENCES "services" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
CREATE UNIQUE INDEX "variablereference_target_service_id_target_name" ON "variable_references" ("target_service_id", "target_name");
CREATE INDEX "variablereference_created_at" ON "variable_references" ("created_at");
CREATE INDEX "variablereference_target_service_id" ON "variable_references" ("target_service_id");
CREATE INDEX "variablereference_target_service_id_created_at" ON "variable_references" ("target_service_id", "created_at");
