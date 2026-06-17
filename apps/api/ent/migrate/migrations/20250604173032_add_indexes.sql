-- +goose Up
-- create index "deployment_created_at" to table: "deployments"
CREATE INDEX IF NOT EXISTS "deployment_created_at" ON "deployments" ("created_at");
-- create index "deployment_service_id" to table: "deployments"
CREATE INDEX IF NOT EXISTS "deployment_service_id" ON "deployments" ("service_id");
-- create index "deployment_service_id_created_at" to table: "deployments"
CREATE INDEX IF NOT EXISTS "deployment_service_id_created_at" ON "deployments" ("service_id", "created_at");
-- create index "deployment_service_id_status_created_at" to table: "deployments"
CREATE INDEX IF NOT EXISTS "deployment_service_id_status_created_at" ON "deployments" ("service_id", "status", "created_at");
-- create index "service_created_at" to table: "services"
CREATE INDEX IF NOT EXISTS "service_created_at" ON "services" ("created_at");
-- create index "service_environment_id_created_at" to table: "services"
CREATE INDEX IF NOT EXISTS "service_environment_id_created_at" ON "services" ("environment_id", "created_at");
-- create index "service_service_group_id_created_at" to table: "services"
CREATE INDEX IF NOT EXISTS "service_service_group_id_created_at" ON "services" ("service_group_id", "created_at");
-- create index "variablereference_created_at" to table: "variable_references"
CREATE INDEX IF NOT EXISTS "variablereference_created_at" ON "variable_references" ("created_at");
-- create index "variablereference_target_service_id" to table: "variable_references"
CREATE INDEX IF NOT EXISTS "variablereference_target_service_id" ON "variable_references" ("target_service_id");
-- create index "variablereference_target_service_id_created_at" to table: "variable_references"
CREATE INDEX IF NOT EXISTS "variablereference_target_service_id_created_at" ON "variable_references" ("target_service_id", "created_at");

-- +goose Down
-- reverse: create index "variablereference_target_service_id_created_at" to table: "variable_references"
DROP INDEX IF EXISTS "variablereference_target_service_id_created_at";
-- reverse: create index "variablereference_target_service_id" to table: "variable_references"
DROP INDEX IF EXISTS "variablereference_target_service_id";
-- reverse: create index "variablereference_created_at" to table: "variable_references"
DROP INDEX IF EXISTS "variablereference_created_at";
-- reverse: create index "service_service_group_id_created_at" to table: "services"
DROP INDEX IF EXISTS "service_service_group_id_created_at";
-- reverse: create index "service_environment_id_created_at" to table: "services"
DROP INDEX IF EXISTS "service_environment_id_created_at";
-- reverse: create index "service_created_at" to table: "services"
DROP INDEX IF EXISTS "service_created_at";
-- reverse: create index "deployment_service_id_status_created_at" to table: "deployments"
DROP INDEX IF EXISTS "deployment_service_id_status_created_at";
-- reverse: create index "deployment_service_id_created_at" to table: "deployments"
DROP INDEX IF EXISTS "deployment_service_id_created_at";
-- reverse: create index "deployment_service_id" to table: "deployments"
DROP INDEX IF EXISTS "deployment_service_id";
-- reverse: create index "deployment_created_at" to table: "deployments"
DROP INDEX IF EXISTS "deployment_created_at";