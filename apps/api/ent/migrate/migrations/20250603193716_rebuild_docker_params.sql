-- +goose Up
-- modify "service_configs" table
ALTER TABLE "service_configs" RENAME COLUMN "dockerfile_path" TO "docker_builder_path";
ALTER TABLE "service_configs" RENAME COLUMN "dockerfile_context" TO "docker_builder_context";

-- +goose Down
-- reverse: modify "service_configs" table
ALTER TABLE "service_configs" RENAME COLUMN "docker_builder_path" TO "dockerfile_path";
ALTER TABLE "service_configs" RENAME COLUMN "docker_builder_context" TO "dockerfile_context";