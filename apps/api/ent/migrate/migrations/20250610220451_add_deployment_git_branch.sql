-- +goose Up
-- modify "deployments" table
ALTER TABLE "deployments" ADD COLUMN "git_branch" character varying NULL;

-- +goose Down
-- reverse: modify "deployments" table
ALTER TABLE "deployments" DROP COLUMN "git_branch";
