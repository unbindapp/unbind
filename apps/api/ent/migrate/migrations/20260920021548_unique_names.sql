-- +goose Up
-- modify "services" table
ALTER TABLE "services" ADD COLUMN "template_service_id" character varying NULL;

-- Template services were matched to their definition by name. Runs before the renames
-- below, while the names still match.
UPDATE "services" s
SET "template_service_id" = definition_service ->> 'id'
FROM "templates" t, jsonb_array_elements(t."definition" -> 'services') AS definition_service
WHERE t."id" = s."template_id"
  AND definition_service ->> 'name' = s."name";

-- Names become unique among siblings. The oldest of each set of duplicates keeps its
-- name, the others get a suffix, repeated in case a suffixed name is taken as well.
-- +goose StatementBegin
DO $$
DECLARE
  target RECORD;
  renamed INT;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('teams', NULL, 32),
      ('projects', 'team_id', 32),
      ('environments', 'project_id', 32),
      ('services', 'environment_id', 32),
      ('service_groups', 'environment_id', 32),
      ('s3_buckets', 'team_id', 32),
      ('api_keys', 'user_id', 100)
    ) AS targets(table_name, scope_column, max_length)
  LOOP
    LOOP
      EXECUTE format(
        'UPDATE %1$I t
         SET "name" = rtrim(left(t."name", %3$s - 5), ''- '') || ''-'' || substr(md5(random()::text), 1, 4)
         FROM (
           SELECT "id", row_number() OVER (PARTITION BY %2$s, "name" ORDER BY "created_at", "id") AS position
           FROM %1$I
         ) duplicates
         WHERE duplicates."id" = t."id" AND duplicates.position > 1',
        target.table_name, COALESCE(quote_ident(target.scope_column), '1'), target.max_length);
      GET DIAGNOSTICS renamed = ROW_COUNT;
      EXIT WHEN renamed = 0;
    END LOOP;
  END LOOP;
END $$;
-- +goose StatementEnd

-- create index "apikey_user_id_name" to table: "api_keys"
CREATE UNIQUE INDEX "apikey_user_id_name" ON "api_keys" ("user_id", "name");
-- create index "environment_project_id_name" to table: "environments"
CREATE UNIQUE INDEX "environment_project_id_name" ON "environments" ("project_id", "name");
-- create index "project_team_id_name" to table: "projects"
CREATE UNIQUE INDEX "project_team_id_name" ON "projects" ("team_id", "name");
-- create index "s3bucket_team_id_name" to table: "s3_buckets"
CREATE UNIQUE INDEX "s3bucket_team_id_name" ON "s3_buckets" ("team_id", "name");
-- create index "servicegroup_environment_id_name" to table: "service_groups"
CREATE UNIQUE INDEX "servicegroup_environment_id_name" ON "service_groups" ("environment_id", "name");
-- create index "service_environment_id_name" to table: "services"
CREATE UNIQUE INDEX "service_environment_id_name" ON "services" ("environment_id", "name");
-- create index "team_name" to table: "teams"
CREATE UNIQUE INDEX "team_name" ON "teams" ("name");

-- +goose Down
-- The renames cannot be told apart from names someone chose, so they stay.
-- reverse: create index "team_name" to table: "teams"
DROP INDEX "team_name";
-- reverse: create index "service_environment_id_name" to table: "services"
DROP INDEX "service_environment_id_name";
-- reverse: modify "services" table
ALTER TABLE "services" DROP COLUMN "template_service_id";
-- reverse: create index "servicegroup_environment_id_name" to table: "service_groups"
DROP INDEX "servicegroup_environment_id_name";
-- reverse: create index "s3bucket_team_id_name" to table: "s3_buckets"
DROP INDEX "s3bucket_team_id_name";
-- reverse: create index "project_team_id_name" to table: "projects"
DROP INDEX "project_team_id_name";
-- reverse: create index "environment_project_id_name" to table: "environments"
DROP INDEX "environment_project_id_name";
-- reverse: create index "apikey_user_id_name" to table: "api_keys"
DROP INDEX "apikey_user_id_name";
