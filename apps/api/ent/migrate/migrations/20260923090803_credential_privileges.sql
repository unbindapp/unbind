-- +goose Up
-- modify "api_keys" table
ALTER TABLE "api_keys" ADD COLUMN "privileges" jsonb NOT NULL DEFAULT '[]';
ALTER TABLE "api_keys" ALTER COLUMN "privileges" DROP DEFAULT;
-- modify "oauth_authorization_codes" table
ALTER TABLE "oauth_authorization_codes" ADD COLUMN "privileges" jsonb NOT NULL DEFAULT '[]';
ALTER TABLE "oauth_authorization_codes" ALTER COLUMN "privileges" DROP DEFAULT;
-- modify "oauth_grants" table
ALTER TABLE "oauth_grants" ADD COLUMN "privileges" jsonb NOT NULL DEFAULT '[]';
ALTER TABLE "oauth_grants" ALTER COLUMN "privileges" DROP DEFAULT;

-- +goose Down
-- reverse: modify "oauth_grants" table
ALTER TABLE "oauth_grants" DROP COLUMN "privileges";
-- reverse: modify "oauth_authorization_codes" table
ALTER TABLE "oauth_authorization_codes" DROP COLUMN "privileges";
-- reverse: modify "api_keys" table
ALTER TABLE "api_keys" DROP COLUMN "privileges";
