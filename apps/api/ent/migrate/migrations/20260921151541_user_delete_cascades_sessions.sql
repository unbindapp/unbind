-- +goose Up
-- modify "oauth2_tokens" table
ALTER TABLE "oauth2_tokens" DROP CONSTRAINT "oauth2_tokens_users_oauth2_tokens", ADD
CONSTRAINT "oauth2_tokens_users_oauth2_tokens" FOREIGN KEY ("user_oauth2_tokens") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- +goose Down
-- reverse: modify "oauth2_tokens" table
ALTER TABLE "oauth2_tokens" DROP CONSTRAINT "oauth2_tokens_users_oauth2_tokens", ADD
CONSTRAINT "oauth2_tokens_users_oauth2_tokens" FOREIGN KEY ("user_oauth2_tokens") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
