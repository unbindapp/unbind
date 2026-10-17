-- +goose Up
-- modify "system_settings" table
ALTER TABLE "system_settings" ADD COLUMN "team_network_isolation" boolean NOT NULL DEFAULT true;
-- existing installs keep open networking until an admin adds exceptions and turns isolation on
UPDATE "system_settings" SET "team_network_isolation" = false;
-- create "network_exceptions" table
CREATE TABLE "network_exceptions" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "source_service_id" uuid NULL,
  "target_service_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "network_exceptions_services_incoming_network_exceptions" FOREIGN KEY ("target_service_id") REFERENCES "services" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "network_exceptions_services_outgoing_network_exceptions" FOREIGN KEY ("source_service_id") REFERENCES "services" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "networkexception_source_service_id_target_service_id" to table: "network_exceptions"
CREATE UNIQUE INDEX "networkexception_source_service_id_target_service_id" ON "network_exceptions" ("source_service_id", "target_service_id");

-- +goose Down
-- reverse: create index "networkexception_source_service_id_target_service_id" to table: "network_exceptions"
DROP INDEX "networkexception_source_service_id_target_service_id";
-- reverse: create "network_exceptions" table
DROP TABLE "network_exceptions";
-- reverse: modify "system_settings" table
ALTER TABLE "system_settings" DROP COLUMN "team_network_isolation";
