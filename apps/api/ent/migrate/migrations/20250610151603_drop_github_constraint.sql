-- +goose Up
-- drop index "githubinstallation_github_app_id" from table: "github_installations"
DROP INDEX "githubinstallation_github_app_id";

-- +goose Down
-- reverse: drop index "githubinstallation_github_app_id" from table: "github_installations"
CREATE UNIQUE INDEX "githubinstallation_github_app_id" ON "github_installations" ("github_app_id");
