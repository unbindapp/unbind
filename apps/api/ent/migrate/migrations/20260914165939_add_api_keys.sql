-- +goose Up
-- create "api_keys" table
CREATE TABLE "api_keys" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "name" character varying NOT NULL,
  "token_prefix" character varying NOT NULL,
  "token_hash" character varying NOT NULL,
  "scopes" jsonb NOT NULL,
  "expires_at" timestamptz NULL,
  "last_used_at" timestamptz NULL,
  "user_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "api_keys_users_api_keys" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "api_keys_token_hash_key" to table: "api_keys"
CREATE UNIQUE INDEX "api_keys_token_hash_key" ON "api_keys" ("token_hash");

-- +goose Down
-- reverse: create index "api_keys_token_hash_key" to table: "api_keys"
DROP INDEX "api_keys_token_hash_key";
-- reverse: create "api_keys" table
DROP TABLE "api_keys";
