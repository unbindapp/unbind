-- +goose Up
UPDATE "permissions" SET "action" = 'editor' WHERE "action" = 'edit';
UPDATE "permissions" SET "action" = 'viewer' WHERE "action" = 'view';
-- keys minted under the scope model cannot be mapped onto role + resources
DELETE FROM "api_keys";
ALTER TABLE "api_keys"
  DROP COLUMN "scopes",
  ADD COLUMN "role" character varying NOT NULL,
  ADD COLUMN "full_access" boolean NOT NULL DEFAULT false,
  ADD COLUMN "resources" jsonb NOT NULL;

-- +goose Down
DELETE FROM "api_keys";
ALTER TABLE "api_keys"
  DROP COLUMN "resources",
  DROP COLUMN "full_access",
  DROP COLUMN "role",
  ADD COLUMN "scopes" jsonb NOT NULL;
UPDATE "permissions" SET "action" = 'edit' WHERE "action" = 'editor';
UPDATE "permissions" SET "action" = 'view' WHERE "action" = 'viewer';
