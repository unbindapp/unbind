-- +goose Up
-- modify "github_apps" table
ALTER TABLE "github_apps" DROP CONSTRAINT "github_apps_users_created_by", ALTER COLUMN "created_by" DROP NOT NULL, ADD
CONSTRAINT "github_apps_users_created_by" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

-- +goose Down
-- reverse: modify "github_apps" table
ALTER TABLE "github_apps" DROP CONSTRAINT "github_apps_users_created_by", ALTER COLUMN "created_by" SET NOT NULL, ADD
CONSTRAINT "github_apps_users_created_by" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
