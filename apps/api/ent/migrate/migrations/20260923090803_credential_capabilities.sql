-- +goose Up
-- modify "api_keys" table
ALTER TABLE "api_keys" ADD COLUMN "capabilities" jsonb NOT NULL DEFAULT '[]';
ALTER TABLE "api_keys" ALTER COLUMN "capabilities" DROP DEFAULT;
-- modify "oauth_authorization_codes" table
ALTER TABLE "oauth_authorization_codes" ADD COLUMN "capabilities" jsonb NOT NULL DEFAULT '[]';
ALTER TABLE "oauth_authorization_codes" ALTER COLUMN "capabilities" DROP DEFAULT;
-- modify "oauth_grants" table
ALTER TABLE "oauth_grants" ADD COLUMN "capabilities" jsonb NOT NULL DEFAULT '[]';
ALTER TABLE "oauth_grants" ALTER COLUMN "capabilities" DROP DEFAULT;

-- +goose Down
-- reverse: modify "oauth_grants" table
ALTER TABLE "oauth_grants" DROP COLUMN "capabilities";
-- reverse: modify "oauth_authorization_codes" table
ALTER TABLE "oauth_authorization_codes" DROP COLUMN "capabilities";
-- reverse: modify "api_keys" table
ALTER TABLE "api_keys" DROP COLUMN "capabilities";
