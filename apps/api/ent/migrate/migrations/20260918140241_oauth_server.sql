-- +goose Up
-- drop "oauth2_codes" table
DROP TABLE IF EXISTS "oauth2_codes";
-- create "oauth_clients" table
CREATE TABLE "oauth_clients" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "client_id" character varying NOT NULL,
  "name" character varying NOT NULL,
  "redirect_uris" jsonb NOT NULL,
  "client_uri" character varying NULL,
  "last_used_at" timestamptz NULL,
  PRIMARY KEY ("id")
);
-- create index "oauth_clients_client_id_key" to table: "oauth_clients"
CREATE UNIQUE INDEX "oauth_clients_client_id_key" ON "oauth_clients" ("client_id");
-- create index "oauthclient_created_at" to table: "oauth_clients"
CREATE INDEX "oauthclient_created_at" ON "oauth_clients" ("created_at");
-- create "oauth_authorization_codes" table
CREATE TABLE "oauth_authorization_codes" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "code_hash" character varying NOT NULL,
  "client_id" character varying NOT NULL,
  "client_name" character varying NOT NULL,
  "client_kind" character varying NOT NULL,
  "client_uri" character varying NULL,
  "redirect_uri" character varying NOT NULL,
  "code_challenge" character varying NOT NULL,
  "resource" character varying NOT NULL,
  "scope" character varying NULL,
  "role" character varying NOT NULL,
  "full_access" boolean NOT NULL DEFAULT false,
  "resources" jsonb NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz NULL,
  "grant_id" uuid NULL,
  "user_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "oauth_authorization_codes_users_oauth_authorization_codes" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "oauth_authorization_codes_code_hash_key" to table: "oauth_authorization_codes"
CREATE UNIQUE INDEX "oauth_authorization_codes_code_hash_key" ON "oauth_authorization_codes" ("code_hash");
-- create index "oauthauthorizationcode_expires_at" to table: "oauth_authorization_codes"
CREATE INDEX "oauthauthorizationcode_expires_at" ON "oauth_authorization_codes" ("expires_at");
-- create "oauth_grants" table
CREATE TABLE "oauth_grants" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "client_id" character varying NOT NULL,
  "client_name" character varying NOT NULL,
  "client_kind" character varying NOT NULL,
  "client_uri" character varying NULL,
  "redirect_uri" character varying NOT NULL,
  "role" character varying NOT NULL,
  "full_access" boolean NOT NULL DEFAULT false,
  "resources" jsonb NOT NULL,
  "resource" character varying NOT NULL,
  "scope" character varying NULL,
  "last_used_at" timestamptz NULL,
  "revoked_at" timestamptz NULL,
  "user_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "oauth_grants_users_oauth_grants" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "oauthgrant_client_id" to table: "oauth_grants"
CREATE INDEX "oauthgrant_client_id" ON "oauth_grants" ("client_id");
-- create index "oauthgrant_user_id" to table: "oauth_grants"
CREATE INDEX "oauthgrant_user_id" ON "oauth_grants" ("user_id");
-- create "oauth_grant_tokens" table
CREATE TABLE "oauth_grant_tokens" (
  "id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "kind" character varying NOT NULL,
  "token_hash" character varying NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz NULL,
  "grant_id" uuid NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "oauth_grant_tokens_oauth_grants_tokens" FOREIGN KEY ("grant_id") REFERENCES "oauth_grants" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "oauth_grant_tokens_token_hash_key" to table: "oauth_grant_tokens"
CREATE UNIQUE INDEX "oauth_grant_tokens_token_hash_key" ON "oauth_grant_tokens" ("token_hash");
-- create index "oauthgranttoken_expires_at" to table: "oauth_grant_tokens"
CREATE INDEX "oauthgranttoken_expires_at" ON "oauth_grant_tokens" ("expires_at");
-- create index "oauthgranttoken_grant_id" to table: "oauth_grant_tokens"
CREATE INDEX "oauthgranttoken_grant_id" ON "oauth_grant_tokens" ("grant_id");

-- +goose Down
-- reverse: create index "oauthgranttoken_grant_id" to table: "oauth_grant_tokens"
DROP INDEX "oauthgranttoken_grant_id";
-- reverse: create index "oauthgranttoken_expires_at" to table: "oauth_grant_tokens"
DROP INDEX "oauthgranttoken_expires_at";
-- reverse: create index "oauth_grant_tokens_token_hash_key" to table: "oauth_grant_tokens"
DROP INDEX "oauth_grant_tokens_token_hash_key";
-- reverse: create "oauth_grant_tokens" table
DROP TABLE "oauth_grant_tokens";
-- reverse: create index "oauthgrant_user_id" to table: "oauth_grants"
DROP INDEX "oauthgrant_user_id";
-- reverse: create index "oauthgrant_client_id" to table: "oauth_grants"
DROP INDEX "oauthgrant_client_id";
-- reverse: create "oauth_grants" table
DROP TABLE "oauth_grants";
-- reverse: create index "oauthauthorizationcode_expires_at" to table: "oauth_authorization_codes"
DROP INDEX "oauthauthorizationcode_expires_at";
-- reverse: create index "oauth_authorization_codes_code_hash_key" to table: "oauth_authorization_codes"
DROP INDEX "oauth_authorization_codes_code_hash_key";
-- reverse: create "oauth_authorization_codes" table
DROP TABLE "oauth_authorization_codes";
-- reverse: create index "oauthclient_created_at" to table: "oauth_clients"
DROP INDEX "oauthclient_created_at";
-- reverse: create index "oauth_clients_client_id_key" to table: "oauth_clients"
DROP INDEX "oauth_clients_client_id_key";
-- reverse: create "oauth_clients" table
DROP TABLE "oauth_clients";
